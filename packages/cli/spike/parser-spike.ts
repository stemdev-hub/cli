import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { remark } from 'remark';
import { SKIP, visit } from 'unist-util-visit';

type Point = { line: number; column: number; offset?: number };
type Position = { start: Point; end: Point };
type Node = {
  type: string;
  value?: string;
  children?: Node[];
  position?: Position;
  [key: string]: unknown;
};

type StemNode =
  | {
      type: 'stemBlockRef';
      blockId: string;
      section: string | null;
      tag: string | null;
      raw: string;
      position: Position;
    }
  | { type: 'stemSection'; name: string; raw: string; position: Position }
  | { type: 'stemTag'; name: string; section: string | null; raw: string; position: Position }
  | {
      type: 'stemDep';
      blockId: string;
      section: string | null;
      tag: string | null;
      raw: string;
      position: Position;
    }
  | { type: 'stemEnd'; raw: string; position: Position };

const stemPattern =
  /@stem\[(end|((?:block|section|tag|dep)):([A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)?)(?:\s+([^\]]+))?)\]/g;
const here = dirname(fileURLToPath(import.meta.url));
const inputPath = join(here, 'test-input.md');
const markdown = await readFile(inputPath, 'utf8');
const processor = remark().use(stemTextNodePlugin);
const baselineTree = remark().parse(markdown) as Node;
const originalTree = processor.parse(markdown) as Node;
const transformedTree = (await processor.run(originalTree)) as Node;

const found: StemNode[] = [];
visit(transformedTree, (node: Node) => {
  if (node.type.startsWith('stem')) {
    found.push(node as StemNode);
  }
});

const fencedCodeMacros = collectCodeMacros(transformedTree, 'code');
const inlineCodeMacros = collectCodeMacros(transformedTree, 'inlineCode');
const beforeStructure = getMarkdownStructure(baselineTree);
const afterStructure = getMarkdownStructure(transformedTree);

console.log('=== Extracted Stem Nodes ===');
for (const node of found) {
  console.log(JSON.stringify(node));
}

console.log('\n=== Isolation Check ===');
console.log(`Found outside code: ${found.length}`);
console.log(`Macros still present in fenced code text (ignored by plugin): ${fencedCodeMacros.length}`);
console.log(`Macros still present in inline code text (ignored by plugin): ${inlineCodeMacros.length}`);
console.log(`Stem custom nodes created inside code/inlineCode: ${countNestedStemNodesInCode(transformedTree)}`);

console.log('\n=== Regular Markdown Check ===');
console.log(`before transform: ${JSON.stringify(beforeStructure)}`);
console.log(`after transform:  ${JSON.stringify(afterStructure)}`);
console.log(`unchanged structure: ${JSON.stringify(beforeStructure) === JSON.stringify(afterStructure)}`);

console.log('\n=== Full Transformed AST ===');
console.log(JSON.stringify(transformedTree, null, 2));

function stemTextNodePlugin(): (tree: Node) => void {
  return function transformer(tree: Node): void {
    visit(tree, 'text', (node: Node, index: number | undefined, parent: Node | undefined) => {
      if (
        typeof node.value !== 'string' ||
        node.position === undefined ||
        index === undefined ||
        parent?.children === undefined ||
        parent.type === 'code' ||
        parent.type === 'inlineCode'
      ) {
        return;
      }

      const replacements = replaceText(node);
      if (replacements === null) {
        return;
      }

      parent.children.splice(index, 1, ...replacements);
      return [SKIP, index + replacements.length];
    });
  };
}

function replaceText(node: Node): Node[] | null {
  if (typeof node.value !== 'string' || node.position === undefined) {
    return null;
  }

  const matches = [...node.value.matchAll(stemPattern)];
  if (matches.length === 0) {
    return null;
  }

  const replacements: Node[] = [];
  let cursor = 0;

  for (const match of matches) {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;
    if (start > cursor) {
      replacements.push({
        type: 'text',
        value: node.value.slice(cursor, start),
        position: positionForSlice(node, cursor, start)
      });
    }
    replacements.push(parseStemNode(match, positionForSlice(node, start, end)));
    cursor = end;
  }

  if (cursor < node.value.length) {
    replacements.push({
      type: 'text',
      value: node.value.slice(cursor),
      position: positionForSlice(node, cursor, node.value.length)
    });
  }

  return replacements;
}

function parseStemNode(match: RegExpMatchArray, position: Position): StemNode {
  const raw = match[0];
  if (match[1] === 'end') {
    return { type: 'stemEnd', raw, position };
  }

  const type = match[2] ?? '';
  const identifier = match[3] ?? '';
  const params = parseParams(match[4] ?? '');
  if (type === 'block') {
    return {
      type: 'stemBlockRef',
      blockId: identifier,
      section: params.section,
      tag: params.tag,
      raw,
      position
    };
  }
  if (type === 'section') {
    return { type: 'stemSection', name: identifier, raw, position };
  }
  if (type === 'tag') {
    return { type: 'stemTag', name: identifier, section: params.section, raw, position };
  }
  const [blockId = '', scope] = identifier.split('#', 2);
  const [section, tag] = scope?.split('.', 2) ?? [];
  return {
    type: 'stemDep',
    blockId,
    section: section ?? null,
    tag: tag ?? null,
    raw,
    position
  };
}

function parseParams(rawParams: string): { section: string | null; tag: string | null } {
  let section: string | null = null;
  let tag: string | null = null;
  for (const param of rawParams.split(/\s+/).filter(Boolean)) {
    const [key, value] = param.split('=', 2);
    if (key === 'section' && value !== undefined) {
      section = value;
    }
    if (key === 'tag' && value !== undefined) {
      tag = value;
    }
  }
  return { section, tag };
}

function positionForSlice(node: Node, start: number, end: number): Position {
  const base = node.position?.start ?? { line: 1, column: 1 };
  return {
    start: advancePoint(base, node.value ?? '', start),
    end: advancePoint(base, node.value ?? '', end)
  };
}

function advancePoint(base: Point, value: string, length: number): Point {
  let line = base.line;
  let column = base.column;
  for (let index = 0; index < length; index += 1) {
    if (value[index] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function collectCodeMacros(tree: Node, type: 'code' | 'inlineCode'): string[] {
  const values: string[] = [];
  visit(tree, type, (node: Node) => {
    if (typeof node.value === 'string') {
      values.push(...(node.value.match(stemPattern) ?? []));
    }
  });
  return values;
}

function countNestedStemNodesInCode(tree: Node): number {
  let total = 0;
  visit(tree, (node: Node) => {
    if ((node.type === 'code' || node.type === 'inlineCode') && node.children !== undefined) {
      total += node.children.filter((child) => child.type.startsWith('stem')).length;
    }
  });
  return total;
}

function countNodes(tree: Node, type: string): number {
  let count = 0;
  visit(tree, type, () => {
    count += 1;
  });
  return count;
}

function getMarkdownStructure(tree: Node): { headings: number; paragraphs: number; lists: number } {
  return {
    headings: countNodes(tree, 'heading'),
    paragraphs: countNodes(tree, 'paragraph'),
    lists: countNodes(tree, 'list')
  };
}
