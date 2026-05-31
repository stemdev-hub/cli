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
    errors: [...frontmatter.errors, ...resolved.errors]
  };
}

export function parseMarkdownBody(markdown: string): StemRoot {
  const processor = remark().use(createStemRemarkPlugin);
  // remark produces mdast; StemRoot is the project-local extension of that tree shape.
  const tree = processor.parse(markdown) as StemRoot;
  tree.data = { ...(tree.data ?? {}), stemSource: markdown };
  // The Stem plugin only injects known custom nodes, preserving the root tree shape.
  return processor.runSync(tree) as StemRoot;
}
