import { remark } from 'remark';
import type {
  BlockRef,
  ParsedBlock,
  ParsedView,
  Position,
  SourceRange,
  StemASTNode,
  StemBlockRefNode,
  ValidationIssue,
  ValidationResult
} from '@stem/types';
import { parseMarkdownBody } from '../parser/index.js';
import {
  createStemRemarkPlugin,
  parseStemMacro,
  type StemMdastNode,
  type StemParentNode,
  type StemRoot,
  type StemTextNode
} from '../parser/stem-plugin.js';

interface OffsetReplacement {
  startOffset: number;
  endOffset: number;
  replacement: string;
}

interface ResolvedFragment {
  content: string;
  range: SourceRange;
  block: ParsedBlock;
}

interface CompositionAction {
  container: StemParentNode;
  index: number;
  replacement: StemMdastNode[];
  listItem: StemParentNode | null;
  list: StemParentNode | null;
}

interface TraversalContext {
  parent: StemParentNode;
  index: number;
  ancestors: StemMdastNode[];
}

export type RenderMarkdownResult =
  | { success: true; markdown: string }
  | { success: false; validation: ValidationResult };

const STRINGIFY_OPTIONS = {
  bullet: '-',
  emphasis: '_',
  strong: '*',
  fence: '`',
  rule: '-'
} as const;

export function renderViewMarkdown(view: ParsedView, blocks: ParsedBlock[]): RenderMarkdownResult {
  return view.blockRefs.some((blockRef) => blockRef.syntax === 'extended')
    ? renderViewMarkdownAst(view, blocks)
    : renderViewMarkdownLegacy(view, blocks);
}

function renderViewMarkdownLegacy(view: ParsedView, blocks: ParsedBlock[]): RenderMarkdownResult {
  const replacements = view.blockRefs
    .map((blockRef) => toReplacement(blockRef, blocks))
    .filter((replacement): replacement is OffsetReplacement => replacement !== null);

  return { success: true, markdown: applyOffsetReplacements(view.localContent, replacements) };
}

function renderViewMarkdownAst(view: ParsedView, blocks: ParsedBlock[]): RenderMarkdownResult {
  const tree = cloneTree(parseMarkdownBody(view.localContent));
  const issues: ValidationIssue[] = [];
  const actions: CompositionAction[] = [];

  for (const context of findBlockReferenceContexts(tree)) {
    const node = context.parent.children[context.index];
    if (!isStemBlockRefNode(node)) {
      continue;
    }

    const fragments = resolveBlockSelection(node, blocks);
    if (fragments.length === 0) {
      issues.push(createBrokenBlockRefIssue(node, view));
      continue;
    }

    const replacement = fragments.flatMap((fragment) =>
      renderFragment(fragment, node, view, issues)
    );
    const placement = getCompositionPlacement(context, node, view);
    if (placement.success) {
      actions.push({
        container: placement.container,
        index: placement.index,
        replacement,
        listItem: placement.listItem,
        list: placement.list
      });
    } else {
      issues.push(placement.issue);
    }
  }

  if (issues.length > 0) {
    return { success: false, validation: toValidationResult(issues) };
  }

  applyCompositionActions(actions);
  removeStemControlNodes(tree);

  const processor = remark().use(createStemRemarkPlugin).data('settings', STRINGIFY_OPTIONS);
  return { success: true, markdown: processor.stringify(tree as never).trim() };
}

function toReplacement(blockRef: BlockRef, blocks: ParsedBlock[]): OffsetReplacement | null {
  const startOffset = blockRef.position.start.offset;
  const endOffset = blockRef.position.end.offset;
  if (startOffset === undefined || endOffset === undefined) {
    return null;
  }

  const fragments = resolveBlockSelection(blockRef, blocks);
  if (fragments.length === 0) {
    return null;
  }

  return {
    startOffset,
    endOffset,
    replacement: fragments.map((fragment) => cleanRenderedMarkdown(fragment.content)).join('\n')
  };
}

function resolveBlockSelection(blockRef: Pick<BlockRef, 'blockId' | 'section' | 'tag'>, blocks: ParsedBlock[]): ResolvedFragment[] {
  const block = blocks.find((candidate) => candidate.id === blockRef.blockId);
  if (block === undefined) {
    return [];
  }

  if (blockRef.section === null) {
    return [{ content: block.rawContent, range: { startOffset: 0, endOffset: block.rawContent.length }, block }];
  }

  const section = block.sections.find((candidate) => candidate.name === blockRef.section);
  if (section === undefined) {
    return [];
  }

  if (blockRef.tag === null) {
    return [{ content: section.prose, range: section.proseRange, block }];
  }

  return [...section.tags, ...section.externalTags]
    .filter((candidate) => candidate.name === blockRef.tag)
    .sort((left, right) => (left.position.start.offset ?? 0) - (right.position.start.offset ?? 0))
    .map((tag) => ({ content: tag.content, range: tag.contentRange, block }));
}

function renderFragment(
  fragment: ResolvedFragment,
  blockRef: StemBlockRefNode,
  view: ParsedView,
  issues: ValidationIssue[]
): StemMdastNode[] {
  const tree = parseMarkdownBody(fragment.content);
  removeStemControlNodes(tree);

  const params = toParameterMap(blockRef);
  substitutePlaceholders(tree, fragment, params, blockRef, view, issues);
  return tree.children;
}

function toParameterMap(blockRef: StemBlockRefNode): Map<string, string> {
  return new Map(blockRef.parameters.map((parameter) => [parameter.name, parameter.value]));
}

function substitutePlaceholders(
  node: StemMdastNode,
  fragment: ResolvedFragment,
  params: Map<string, string>,
  blockRef: StemBlockRefNode,
  view: ParsedView,
  issues: ValidationIssue[]
): void {
  if (isValueNode(node)) {
    const replaced = replacePlaceholders(node.value, (name, placeholderOffset, raw) => {
      const sourceOffset = (node.position?.start.offset ?? 0) + placeholderOffset;
      if (isEscapedPlaceholderInSource(fragment.content, sourceOffset)) {
        return raw;
      }

      if (params.has(name)) {
        return params.get(name) ?? '';
      }

      const absoluteOffset = fragment.range.startOffset + sourceOffset;
      issues.push(createMissingVariableIssue(fragment.block, absoluteOffset, raw.length, name, blockRef, view));
      return raw;
    });
    node.value = replaced;
  }

  if (isParentNode(node)) {
    for (const child of node.children) {
      substitutePlaceholders(child, fragment, params, blockRef, view, issues);
    }
  }
}

function isEscapedPlaceholderInSource(source: string, placeholderOffset: number): boolean {
  return source[placeholderOffset] === '\\' || source[placeholderOffset - 1] === '\\';
}

function replacePlaceholders(
  value: string,
  replace: (name: string, placeholderOffset: number, raw: string) => string
): string {
  let output = '';
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf('{{', cursor);
    if (start < 0) {
      output += value.slice(cursor);
      break;
    }

    if (start > 0 && value[start - 1] === '\\') {
      output += value.slice(cursor, start - 1);
      output += '{{';
      cursor = start + 2;
      continue;
    }

    const end = value.indexOf('}}', start + 2);
    if (end < 0) {
      output += value.slice(cursor);
      break;
    }

    const raw = value.slice(start, end + 2);
    const name = value.slice(start + 2, end).trim();
    if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
      output += value.slice(cursor, start);
      output += replace(name, start, raw);
      cursor = end + 2;
      continue;
    }

    output += value.slice(cursor, end + 2);
    cursor = end + 2;
  }

  return output;
}

function getCompositionPlacement(
  context: TraversalContext,
  blockRef: StemBlockRefNode,
  view: ParsedView
):
  | { success: true; container: StemParentNode; index: number; listItem: StemParentNode | null; list: StemParentNode | null }
  | { success: false; issue: ValidationIssue } {
  if (context.ancestors.some((ancestor) => ancestor.type === 'tableCell')) {
    return { success: false, issue: createPlacementIssue('BLOCK_REFERENCE_IN_TABLE_CELL', blockRef, view) };
  }

  const paragraph = context.parent;
  const grandparent = context.ancestors.at(-1);
  if (
    paragraph.type !== 'paragraph' ||
    grandparent === undefined ||
    !isParentNode(grandparent) ||
    !isAllowedFlowContainer(grandparent) ||
    !isSoleNonWhitespaceChild(paragraph, context.index)
  ) {
    return { success: false, issue: createPlacementIssue('INLINE_BLOCK_REFERENCE', blockRef, view) };
  }

  const paragraphIndex = grandparent.children.indexOf(paragraph);
  const listItem = grandparent.type === 'listItem' ? grandparent : null;
  const list = listItem === null ? null : findImmediateListAncestor(context.ancestors);
  return { success: true, container: grandparent, index: paragraphIndex, listItem, list };
}

function findBlockReferenceContexts(root: StemRoot): TraversalContext[] {
  const contexts: TraversalContext[] = [];
  visitChildren(root, [], (context) => {
    const node = context.parent.children[context.index];
    if (isStemBlockRefNode(node)) {
      contexts.push(context);
    }
  });
  return contexts;
}

function visitChildren(
  parent: StemParentNode,
  ancestors: StemMdastNode[],
  visitor: (context: TraversalContext) => void
): void {
  const nextAncestors = [...ancestors, parent];
  for (let index = 0; index < parent.children.length; index += 1) {
    visitor({ parent, index, ancestors });
    const child = parent.children[index];
    if (isParentNode(child)) {
      visitChildren(child, nextAncestors, visitor);
    }
  }
}

function applyCompositionActions(actions: CompositionAction[]): void {
  for (const action of [...actions].sort((left, right) => right.index - left.index)) {
    action.container.children.splice(action.index, 1, ...action.replacement);
    if (action.replacement.length > 1) {
      if (action.listItem !== null) {
        Object.assign(action.listItem, { spread: true });
      }
      if (action.list !== null) {
        Object.assign(action.list, { spread: true });
      }
    }
  }
}

function removeStemControlNodes(parent: StemParentNode): void {
  for (const child of parent.children) {
    if (isParentNode(child)) {
      removeStemControlNodes(child);
    }
  }

  parent.children = parent.children.filter((child) => {
    if (isStemControlNode(child)) {
      return false;
    }
    return !(isParentNode(child) && child.type === 'paragraph' && isWhitespaceOnlyParent(child));
  });
}

function cleanRenderedMarkdown(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        return true;
      }
      const parsed = parseStemMacro(trimmed);
      return parsed === null;
    })
    .join('\n')
    .trim();
}

function applyOffsetReplacements(content: string, replacements: OffsetReplacement[]): string {
  const sorted = [...replacements].sort((left, right) => right.startOffset - left.startOffset);
  let current = content;

  for (const replacement of sorted) {
    current = `${current.slice(0, replacement.startOffset)}${replacement.replacement}${current.slice(replacement.endOffset)}`;
  }

  return current;
}

function createMissingVariableIssue(
  block: ParsedBlock,
  bodyOffset: number,
  length: number,
  variableName: string,
  blockRef: StemBlockRefNode,
  view: ParsedView
): ValidationIssue {
  const viewStart = shiftPosition(blockRef.position, view.bodyStartLine - 1).start;
  return {
    code: 'MISSING_BLOCK_VARIABLE',
    severity: 'error',
    message: `Block "${block.id}" uses variable "${variableName}" but the reference did not pass it.`,
    filePath: block.filePath,
    relativePath: block.relativePath,
    position: positionAt(block.rawContent, bodyOffset, length, block.bodyStartLine),
    context: {
      blockId: block.id,
      variableName,
      rawRef: blockRef.raw,
      viewPath: view.relativePath,
      viewLine: viewStart.line,
      viewColumn: viewStart.column
    }
  };
}

function createBrokenBlockRefIssue(blockRef: StemBlockRefNode, view: ParsedView): ValidationIssue {
  return {
    code: 'BROKEN_BLOCK_REF',
    severity: 'error',
    message: `View references missing block "${blockRef.blockId}".`,
    filePath: view.filePath,
    relativePath: view.relativePath,
    position: shiftPosition(blockRef.position, view.bodyStartLine - 1),
    context: {
      targetId: blockRef.blockId,
      rawRef: blockRef.raw
    }
  };
}

function createPlacementIssue(
  code: 'INLINE_BLOCK_REFERENCE' | 'BLOCK_REFERENCE_IN_TABLE_CELL',
  blockRef: StemBlockRefNode,
  view: ParsedView
): ValidationIssue {
  return {
    code,
    severity: 'error',
    message:
      code === 'INLINE_BLOCK_REFERENCE'
        ? `Block reference "${blockRef.raw}" must be the only non-whitespace content in a paragraph.`
        : `Block reference "${blockRef.raw}" is not supported inside table cells.`,
    filePath: view.filePath,
    relativePath: view.relativePath,
    position: shiftPosition(blockRef.position, view.bodyStartLine - 1),
    context: {
      blockId: blockRef.blockId,
      rawRef: blockRef.raw
    }
  };
}

function toValidationResult(issues: ValidationIssue[]): ValidationResult {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.length - errorCount;
  return {
    issues,
    errorCount,
    warningCount,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0
  };
}

function positionAt(source: string, offset: number, length: number, bodyStartLine: number): Position {
  return {
    start: pointAt(source, offset, bodyStartLine),
    end: pointAt(source, offset + length, bodyStartLine)
  };
}

function pointAt(source: string, offset: number, bodyStartLine: number): Position['start'] {
  let line = bodyStartLine;
  let column = 1;
  const safeOffset = Math.max(0, Math.min(offset, source.length));

  for (let index = 0; index < safeOffset; index += 1) {
    if (source[index] === '\n') {
      line += 1;
      column = 1;
    } else if (!isTrailingSurrogate(source.charCodeAt(index))) {
      column += 1;
    }
  }

  return { line, column, offset: safeOffset };
}

function shiftPosition(position: Position | undefined, lineOffset: number): Position {
  if (position === undefined) {
    return { start: { line: 1 + lineOffset, column: 1 }, end: { line: 1 + lineOffset, column: 1 } };
  }

  return {
    ...position,
    start: { ...position.start, line: position.start.line + lineOffset },
    end: { ...position.end, line: position.end.line + lineOffset }
  };
}

function isSoleNonWhitespaceChild(parent: StemParentNode, macroIndex: number): boolean {
  return parent.children.every((child, index) => index === macroIndex || isWhitespaceTextNode(child));
}

function isAllowedFlowContainer(node: StemMdastNode): boolean {
  return node.type === 'root' || node.type === 'blockquote' || node.type === 'listItem';
}

function findImmediateListAncestor(ancestors: StemMdastNode[]): StemParentNode | null {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (ancestor?.type === 'list' && isParentNode(ancestor)) {
      return ancestor;
    }
  }
  return null;
}

function isWhitespaceOnlyParent(node: StemParentNode): boolean {
  return node.children.every((child) => isWhitespaceTextNode(child));
}

function isWhitespaceTextNode(node: StemMdastNode): boolean {
  return node.type === 'text' && 'value' in node && typeof node.value === 'string' && node.value.trim().length === 0;
}

function isValueNode(node: StemMdastNode): node is StemTextNode {
  return (
    (node.type === 'text' || node.type === 'code' || node.type === 'inlineCode') &&
    'value' in node &&
    typeof node.value === 'string'
  );
}

function isParentNode(node: StemMdastNode | undefined): node is StemParentNode {
  return node !== undefined && 'children' in node && Array.isArray(node.children);
}

function isStemBlockRefNode(node: StemMdastNode | undefined): node is StemBlockRefNode {
  return node?.type === 'stemBlockRef';
}

function isStemControlNode(node: StemMdastNode): boolean {
  return (
    node.type === 'stemSection' ||
    node.type === 'stemTag' ||
    node.type === 'stemEnd' ||
    node.type === 'stemDep' ||
    node.type === 'stemBlockRef' ||
    node.type === 'stemInvalid'
  );
}

function isTrailingSurrogate(charCode: number): boolean {
  return charCode >= 0xdc00 && charCode <= 0xdfff;
}

function cloneTree<T extends StemASTNode>(tree: T): T {
  return JSON.parse(JSON.stringify(tree)) as T;
}
