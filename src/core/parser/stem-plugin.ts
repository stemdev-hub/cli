import { SKIP, visit } from 'unist-util-visit';
import type {
  Position,
  StemASTNode,
  StemBlockRefNode,
  StemDepNode,
  StemSectionNode,
  StemTagNode
} from '@stem/types';

export interface StemEndNode extends StemASTNode {
  type: 'stemEnd';
  raw: string;
}

export type StemSyntaxNode =
  | StemTagNode
  | StemSectionNode
  | StemBlockRefNode
  | StemDepNode
  | StemEndNode;

export interface StemTextNode extends StemASTNode {
  type: 'text';
  value: string;
}

export interface StemParentNode extends StemASTNode {
  children: StemMdastNode[];
}

export type StemMdastNode = StemTextNode | StemSyntaxNode | StemParentNode | StemASTNode;

export interface StemRoot extends StemParentNode {
  type: 'root';
  data?: Record<string, unknown>;
}

interface StemMacro {
  node: StemSyntaxNode;
  startIndex: number;
  endIndex: number;
}

interface StemParameterMap {
  section: string | null;
  tag: string | null;
}

const STEM_IDENTIFIER_PATTERN = '[A-Za-z0-9_-]+';
const STEM_PARAMS_PATTERN = '[^\\]\\r\\n]*';
const STEM_SCOPED_DEP_PATTERN = `${STEM_IDENTIFIER_PATTERN}(?:#${STEM_IDENTIFIER_PATTERN}(?:\\.${STEM_IDENTIFIER_PATTERN})?)?`;

// Matches a single-line Stem macro with no capture groups:
// - @stem[end]
// - @stem[block:id ...params], @stem[section:id ...params], @stem[tag:id ...params]
// - @stem[dep:block-id] and @stem[dep:block-id#section.tag]
const STEM_MACRO_PATTERN = new RegExp(
  `@stem\\[(?:end|(?:block|section|tag):${STEM_IDENTIFIER_PATTERN}(?:[ \\t]+${STEM_PARAMS_PATTERN})?|dep:${STEM_SCOPED_DEP_PATTERN})\\]`,
  'g'
);

// Transform only mdast text nodes; code and inlineCode remain untouched by construction.
export function createStemRemarkPlugin(): (tree: StemRoot) => void {
  return function transformer(tree: StemRoot): void {
    visit(tree, 'text', (node: StemTextNode, index, parent) => {
      if (
        index === undefined ||
        parent === undefined ||
        !('children' in parent) ||
        !Array.isArray(parent.children)
      ) {
        return;
      }

      const replacement = replaceTextNode(node);
      if (replacement === null) {
        return;
      }

      parent.children.splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
}

export function parseStemMacro(raw: string, position?: Position): StemSyntaxNode | null {
  STEM_MACRO_PATTERN.lastIndex = 0;
  const match = STEM_MACRO_PATTERN.exec(raw);
  if (match === null || match[0] !== raw) {
    return null;
  }

  const inner = raw.slice(6, -1);
  if (inner === 'end') {
    return withOptionalPosition<StemEndNode>({ type: 'stemEnd', raw }, position);
  }

  const [head = '', ...parameterParts] = inner.split(/[ \t]+/);
  const separatorIndex = head.indexOf(':');
  const type = head.slice(0, separatorIndex);
  const identifier = head.slice(separatorIndex + 1);
  const params = parseParameters(parameterParts);

  if (type === 'block') {
    return createBlockRefNode(identifier, params, raw, position);
  }

  if (type === 'section') {
    return createSectionNode(identifier, position);
  }

  if (type === 'tag') {
    return createTagNode(identifier, params, position);
  }

  return createDepNode(identifier, raw, position);
}

function createBlockRefNode(
  blockId: string,
  params: StemParameterMap,
  raw: string,
  position: Position | undefined
): StemBlockRefNode {
  return withOptionalPosition<StemBlockRefNode>(
    {
      type: 'stemBlockRef',
      blockId,
      section: params.section,
      tag: params.tag,
      raw
    },
    position
  );
}

function createSectionNode(name: string, position: Position | undefined): StemSectionNode {
  return withOptionalPosition<StemSectionNode>(
    { type: 'stemSection', name, prose: '' },
    position
  );
}

function createTagNode(
  name: string,
  params: StemParameterMap,
  position: Position | undefined
): StemTagNode {
  return withOptionalPosition<StemTagNode>(
    { type: 'stemTag', name, section: params.section, content: '' },
    position
  );
}

function createDepNode(
  identifier: string,
  raw: string,
  position: Position | undefined
): StemDepNode {
  const scoped = parseScopedIdentifier(identifier);
  return withOptionalPosition<StemDepNode>(
    {
      type: 'stemDep',
      blockId: scoped.blockId,
      section: scoped.section,
      tag: scoped.tag,
      raw
    },
    position
  );
}

export function collectStemNodes(tree: StemRoot): StemSyntaxNode[] {
  const nodes: StemSyntaxNode[] = [];
  visit(tree, (node) => {
    if (isStemSyntaxNode(node)) {
      nodes.push(node);
    }
  });
  return nodes;
}

function replaceTextNode(node: StemTextNode): StemMdastNode[] | null {
  const macros = findMacros(node);
  if (macros.length === 0) {
    return null;
  }

  const replacement: StemMdastNode[] = [];
  let cursor = 0;
  for (const macro of macros) {
    if (macro.startIndex > cursor) {
      replacement.push(createTextSlice(node, cursor, macro.startIndex));
    }
    replacement.push(macro.node);
    cursor = macro.endIndex;
  }

  if (cursor < node.value.length) {
    replacement.push(createTextSlice(node, cursor, node.value.length));
  }
  return replacement;
}

function findMacros(node: StemTextNode): StemMacro[] {
  const macros: StemMacro[] = [];
  STEM_MACRO_PATTERN.lastIndex = 0;

  for (const match of node.value.matchAll(STEM_MACRO_PATTERN)) {
    const raw = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + raw.length;
    const parsed = parseStemMacro(raw, slicePosition(node, startIndex, endIndex));
    if (parsed !== null) {
      macros.push({ node: parsed, startIndex, endIndex });
    }
  }
  return macros;
}

function createTextSlice(node: StemTextNode, startIndex: number, endIndex: number): StemTextNode {
  return withOptionalPosition<StemTextNode>(
    { type: 'text', value: node.value.slice(startIndex, endIndex) },
    slicePosition(node, startIndex, endIndex)
  );
}

function slicePosition(
  node: StemTextNode,
  startIndex: number,
  endIndex: number
): Position | undefined {
  if (node.position === undefined) {
    return undefined;
  }
  return {
    start: pointAt(node.position.start, node.value, startIndex),
    end: pointAt(node.position.start, node.value, endIndex)
  };
}

function pointAt(start: Position['start'], value: string, index: number): Position['start'] {
  let line = start.line;
  let column = start.column;
  for (let offset = 0; offset < index; offset += 1) {
    if (value[offset] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  const point: Position['start'] = { line, column };
  if (start.offset !== undefined) {
    point.offset = start.offset + index;
  }
  return point;
}

function parseParameters(parts: string[]): StemParameterMap {
  const params: StemParameterMap = { section: null, tag: null };
  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 'section') {
      params.section = normalizeToken(value);
    } else if (key === 'tag') {
      params.tag = normalizeToken(value);
    }
  }
  return params;
}

function parseScopedIdentifier(identifier: string): StemParameterMap & { blockId: string } {
  const [blockId = '', scope] = identifier.split('#', 2);
  const [section, tag] = scope?.split('.', 2) ?? [];
  return { blockId, section: normalizeToken(section), tag: normalizeToken(tag) };
}

function normalizeToken(value: string | undefined): string | null {
  return value !== undefined && value.trim().length > 0 ? value.trim() : null;
}

function isStemSyntaxNode(node: { type: string }): node is StemSyntaxNode {
  return (
    node.type === 'stemTag' ||
    node.type === 'stemSection' ||
    node.type === 'stemBlockRef' ||
    node.type === 'stemDep' ||
    node.type === 'stemEnd'
  );
}

function withOptionalPosition<T extends StemASTNode>(node: T, position: Position | undefined): T {
  if (position !== undefined) {
    node.position = position;
  }
  return node;
}
