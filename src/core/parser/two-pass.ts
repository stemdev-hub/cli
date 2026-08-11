import type {
  BlockRef,
  DependencyRef,
  Position,
  SourceRange,
  StemSection,
  StemTag,
  ValidationIssue
} from '@stem/types';
import { collectStemNodes } from './stem-plugin.js';
import type { StemEndNode, StemRoot, StemSyntaxNode } from './stem-plugin.js';

export interface TwoPassParseResult {
  sections: StemSection[];
  standaloneTags: StemTag[];
  blockRefs: BlockRef[];
  dependencies: DependencyRef[];
  errors: ValidationIssue[];
}

interface OpenTag {
  tag: StemTag;
  contentStartOffset: number | null;
}

interface OpenSection {
  section: StemSection;
  contentStartOffset: number | null;
}

interface TwoPassState {
  sections: StemSection[];
  sectionRegistry: Map<string, StemSection>;
  standaloneTags: StemTag[];
  externalTags: StemTag[];
  blockRefs: BlockRef[];
  dependencies: DependencyRef[];
  currentSection: OpenSection | null;
  currentTag: OpenTag | null;
}

// Pass 1 discovers section boundaries and physical tags; pass 2 binds scoped external tags.
export function runTwoPassParse(
  tree: StemRoot,
  filePath = '',
  relativePath = ''
): TwoPassParseResult {
  const state: TwoPassState = {
    sections: [],
    sectionRegistry: new Map<string, StemSection>(),
    standaloneTags: [],
    externalTags: [],
    blockRefs: [],
    dependencies: [],
    currentSection: null,
    currentTag: null
  };
  const errors: ValidationIssue[] = [];

  for (const node of collectStemNodes(tree)) {
    collectNode(tree, state, node, errors, filePath, relativePath);
  }

  for (const tag of state.externalTags) {
    const section = tag.section === null ? undefined : state.sectionRegistry.get(tag.section);
    if (section !== undefined) {
      section.externalTags.push(tag);
    } else {
      errors.push(createMissingSectionIssue(tag, filePath, relativePath));
      state.standaloneTags.push(tag);
    }
  }

  return {
    sections: state.sections,
    standaloneTags: state.standaloneTags,
    blockRefs: state.blockRefs,
    dependencies: state.dependencies,
    errors
  };
}

function collectNode(
  tree: StemRoot,
  state: TwoPassState,
  node: StemSyntaxNode,
  errors: ValidationIssue[],
  filePath: string,
  relativePath: string
): void {
  if (node.type === 'stemBlockRef') {
    state.blockRefs.push(toBlockRef(node));
  } else if (node.type === 'stemDep') {
    state.dependencies.push(toDependencyRef(node));
  } else if (node.type === 'stemSection') {
    openSection(state, node);
  } else if (node.type === 'stemTag') {
    openTag(state, node);
  } else if (isStemEndNode(node)) {
    closeCurrentScope(tree, state, node);
  } else if (node.type === 'stemInvalid') {
    errors.push(createInvalidStemParameterIssue(node, filePath, relativePath));
  }
}

function toBlockRef(node: Extract<StemSyntaxNode, { type: 'stemBlockRef' }>): BlockRef {
  return {
    blockId: node.blockId,
    section: node.section,
    tag: node.tag,
    parameters: node.parameters,
    syntax: node.syntax,
    raw: node.raw,
    position: requirePosition(node.position)
  };
}

function toDependencyRef(node: Extract<StemSyntaxNode, { type: 'stemDep' }>): DependencyRef {
  return {
    blockId: node.blockId,
    section: node.section,
    tag: node.tag,
    raw: node.raw
  };
}

function openSection(
  state: TwoPassState,
  node: Extract<StemSyntaxNode, { type: 'stemSection' }>
): void {
  const section: StemSection = {
    name: node.name,
    tags: [],
    externalTags: [],
    prose: node.prose,
    position: requirePosition(node.position),
    proseRange: zeroRange(node.position?.end.offset ?? 0)
  };
  state.currentSection = { section, contentStartOffset: node.position?.end.offset ?? null };
  state.sections.push(section);
  state.sectionRegistry.set(node.name, section);
}

function openTag(state: TwoPassState, node: Extract<StemSyntaxNode, { type: 'stemTag' }>): void {
  const tag: StemTag = {
    name: node.name,
    section: node.section ?? state.currentSection?.section.name ?? null,
    content: '',
    position: requirePosition(node.position),
    contentRange: zeroRange(node.position?.end.offset ?? 0)
  };
  state.currentTag = { tag, contentStartOffset: node.position?.end.offset ?? null };
  if (node.section !== null) {
    state.externalTags.push(tag);
  } else if (state.currentSection !== null) {
    state.currentSection.section.tags.push(tag);
  } else {
    state.standaloneTags.push(tag);
  }
}

function closeCurrentScope(tree: StemRoot, state: TwoPassState, node: StemEndNode): void {
  if (state.currentTag !== null) {
    const extracted = extractContent(
      tree,
      state.currentTag.contentStartOffset,
      node.position?.start.offset
    );
    state.currentTag.tag.content = extracted.content;
    state.currentTag.tag.contentRange = extracted.range;
    state.currentTag = null;
    return;
  }
  if (state.currentSection !== null) {
    const extracted = extractContent(
      tree,
      state.currentSection.contentStartOffset,
      node.position?.start.offset
    );
    state.currentSection.section.prose = extracted.content;
    state.currentSection.section.proseRange = extracted.range;
    if (node.position !== undefined) {
      state.currentSection.section.position = {
        start: state.currentSection.section.position.start,
        end: node.position.end
      };
    }
    state.currentSection = null;
  }
}

function extractContent(
  tree: StemRoot,
  startOffset: number | null,
  endOffset: number | undefined
): { content: string; range: SourceRange } {
  if (startOffset === null || endOffset === undefined || endOffset < startOffset) {
    return { content: '', range: zeroRange(startOffset ?? 0) };
  }
  const source = typeof tree.data?.['stemSource'] === 'string' ? tree.data['stemSource'] : '';
  const raw = source.slice(startOffset, endOffset);
  const leadingTrim = raw.length - raw.trimStart().length;
  const trailingTrim = raw.length - raw.trimEnd().length;
  const trimmedStart = startOffset + leadingTrim;
  const trimmedEnd = Math.max(trimmedStart, endOffset - trailingTrim);
  return {
    content: source.slice(trimmedStart, trimmedEnd),
    range: { startOffset: trimmedStart, endOffset: trimmedEnd }
  };
}

function createMissingSectionIssue(
  tag: StemTag,
  filePath: string,
  relativePath: string
): ValidationIssue {
  return {
    code: 'EXTERNAL_TAG_MISSING_SECTION',
    severity: 'error',
    message: `Tag "${tag.name}" references missing section "${tag.section ?? ''}".`,
    filePath,
    relativePath,
    position: tag.position,
    context: {
      tagName: tag.name,
      sectionName: tag.section ?? ''
    }
  };
}

function createInvalidStemParameterIssue(
  node: Extract<StemSyntaxNode, { type: 'stemInvalid' }>,
  filePath: string,
  relativePath: string
): ValidationIssue {
  const issue: ValidationIssue = {
    code: 'INVALID_STEM_PARAMETER',
    severity: 'error',
    message: node.reason,
    filePath,
    relativePath,
    context: {
      rawRef: node.raw,
      reason: node.reason
    }
  };
  if (node.position !== undefined) {
    return { ...issue, position: node.position };
  }
  return issue;
}

function requirePosition(position: Position | undefined): Position {
  return position ?? { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };
}

function zeroRange(offset: number): SourceRange {
  return { startOffset: offset, endOffset: offset };
}

function isStemEndNode(node: StemSyntaxNode): node is StemEndNode {
  return node.type === 'stemEnd';
}
