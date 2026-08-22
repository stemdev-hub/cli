import { remark } from 'remark';
import type { ParsedBlock, ParsedView, ValidationIssue } from '@stem/types';
import { parseBlockFrontmatter, parseViewFrontmatter } from './frontmatter.js';
import { createStemRemarkPlugin, type StemRoot } from './stem-plugin.js';
import { runTwoPassParse } from './two-pass.js';

export interface ParseFileInput {
  content: string;
  filePath: string;
  relativePath: string;
}

export type ParsedBlockWithErrors = ParsedBlock & { errors: ValidationIssue[] };
export type ParsedViewWithErrors = ParsedView & { errors: ValidationIssue[] };

// Parse block content supplied by the filesystem layer; this module performs no file I/O.
export function parseBlockFile(input: ParseFileInput): ParsedBlockWithErrors {
  const frontmatter = parseBlockFrontmatter(input.content, input.filePath, input.relativePath);
  const resolved = runTwoPassParse(
    parseMarkdownBody(frontmatter.body),
    input.filePath,
    input.relativePath
  );

  return {
    id: frontmatter.data.id,
    tags: frontmatter.data.tags,
    dependsOn: [...frontmatter.data.dependsOn, ...resolved.dependencies],
    sections: resolved.sections,
    standaloneTags: resolved.standaloneTags,
    filePath: input.filePath,
    relativePath: input.relativePath,
    rawContent: frontmatter.body,
    bodyStartLine: frontmatter.bodyStartLine,
    errors: [...frontmatter.errors, ...resolved.errors]
  };
}

// Parse view content while retaining local Markdown source alongside discovered references.
export function parseViewFile(input: ParseFileInput): ParsedViewWithErrors {
  const frontmatter = parseViewFrontmatter(input.content, input.filePath, input.relativePath);
  const resolved = runTwoPassParse(
    parseMarkdownBody(frontmatter.body),
    input.filePath,
    input.relativePath
  );

  return {
    id: frontmatter.data.id,
    group: frontmatter.data.group,
    blockRefs: resolved.blockRefs,
    filePath: input.filePath,
    relativePath: input.relativePath,
    localContent: frontmatter.body,
    bodyStartLine: frontmatter.bodyStartLine,
    errors: [...frontmatter.errors, ...resolved.errors]
  };
}

export function parseMarkdownBody(markdown: string): StemRoot {
  const processor = remark().use(createStemRemarkPlugin);
  const parseableMarkdown = shieldStemMacroMarkdown(markdown);
  // remark produces mdast; StemRoot is the project-local extension of that tree shape.
  const tree = processor.parse(parseableMarkdown) as StemRoot;
  tree.data = { ...(tree.data ?? {}), stemSource: markdown };
  // The Stem plugin only injects known custom nodes, preserving the root tree shape.
  return processor.runSync(tree) as StemRoot;
}

function shieldStemMacroMarkdown(markdown: string): string {
  const lines = markdown.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) ?? [];
  let inFence = false;
  let fenceMarker: string | null = null;
  let output = '';

  for (const line of lines) {
    if (line.length === 0) {
      continue;
    }

    const lineWithoutBreak = line.replace(/\r?\n|\r$/, '');
    const fenceMatch = /^( {0,3})(`{3,}|~{3,})/.exec(lineWithoutBreak);
    if (fenceMatch !== null) {
      const marker = fenceMatch[2]?.[0] ?? null;
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      output += line;
      continue;
    }

    output += inFence ? line : shieldStemMacrosInLine(line);
  }

  return output;
}

function shieldStemMacrosInLine(line: string): string {
  let output = '';
  let cursor = 0;

  while (cursor < line.length) {
    const start = line.indexOf('@stem[', cursor);
    if (start < 0) {
      output += line.slice(cursor);
      break;
    }

    const end = findStemMacroEnd(line, start);
    if (end === null) {
      output += line.slice(cursor);
      break;
    }

    output += line.slice(cursor, start + 6);
    output += shieldMarkdownPunctuation(line.slice(start + 6, end));
    output += ']';
    cursor = end + 1;
  }

  return output;
}

function findStemMacroEnd(value: string, start: number): number | null {
  let cursor = start + 6;
  let inQuote = false;

  while (cursor < value.length) {
    const character = value[cursor];
    if (character === '\r' || character === '\n') {
      return null;
    }

    if (inQuote) {
      if (character === '\\') {
        cursor += 2;
        continue;
      }
      if (character === '"') {
        inQuote = false;
      }
      cursor += 1;
      continue;
    }

    if (character === '"') {
      inQuote = true;
    } else if (character === ']') {
      return cursor;
    }
    cursor += 1;
  }

  return null;
}

function shieldMarkdownPunctuation(value: string): string {
  return value.replace(/([*_`[\]()<>])/g, '\\$1');
}
