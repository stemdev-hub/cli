import type { BlockRef, ParsedBlock, ParsedView } from '@stem/types';

interface OffsetReplacement {
  startOffset: number;
  endOffset: number;
  replacement: string;
}

export function renderViewMarkdown(view: ParsedView, blocks: ParsedBlock[]): string {
  const replacements = view.blockRefs
    .map((blockRef) => toReplacement(blockRef, blocks))
    .filter((replacement): replacement is OffsetReplacement => replacement !== null);

  return applyOffsetReplacements(view.localContent, replacements);
}

function toReplacement(blockRef: BlockRef, blocks: ParsedBlock[]): OffsetReplacement | null {
  const startOffset = blockRef.position.start.offset;
  const endOffset = blockRef.position.end.offset;
  if (startOffset === undefined || endOffset === undefined) {
    return null;
  }

  const block = blocks.find((candidate) => candidate.id === blockRef.blockId);
  if (block === undefined) {
    return null;
  }

  return {
    startOffset,
    endOffset,
    replacement: resolveBlockRef(block, blockRef)
  };
}

function resolveBlockRef(block: ParsedBlock, blockRef: BlockRef): string {
  if (blockRef.section === null) {
    return cleanRenderedMarkdown(block.rawContent);
  }

  const section = block.sections.find((candidate) => candidate.name === blockRef.section);
  if (section === undefined) {
    return '';
  }

  if (blockRef.tag === null) {
    return cleanRenderedMarkdown(section.prose);
  }

  return [...section.tags, ...section.externalTags]
    .filter((candidate) => candidate.name === blockRef.tag)
    .sort((left, right) => (left.position.start.offset ?? 0) - (right.position.start.offset ?? 0))
    .map((tag) => tag.content)
    .join('\n');
}

function applyOffsetReplacements(content: string, replacements: OffsetReplacement[]): string {
  const sorted = [...replacements].sort((left, right) => right.startOffset - left.startOffset);
  let current = content;

  for (const replacement of sorted) {
    current = `${current.slice(0, replacement.startOffset)}${replacement.replacement}${current.slice(replacement.endOffset)}`;
  }

  return current;
}

function cleanRenderedMarkdown(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !/^\s*@stem\[(?:end|(?:block|section|tag):[A-Za-z0-9_-]+(?:[ \t]+[^\]\r\n]*)?|dep:[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)?)\]\s*$/.test(line))
    .join('\n')
    .trim();
}
