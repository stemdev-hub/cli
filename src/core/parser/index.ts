import type { ParsedBlock, ParsedView, ValidationIssue } from '@stem/types';

export interface ParseFileInput {
  content: string;
  filePath: string;
  relativePath: string;
}

export type ParsedBlockWithErrors = ParsedBlock & { errors: ValidationIssue[] };
export type ParsedViewWithErrors = ParsedView & { errors: ValidationIssue[] };

// TODO: Orchestrate frontmatter, Markdown syntax, and two-pass resolution for block content.
export function parseBlockFile(input: ParseFileInput): ParsedBlockWithErrors {
  return {
    id: '',
    tags: [],
    dependsOn: [],
    sections: [],
    standaloneTags: [],
    filePath: input.filePath,
    relativePath: input.relativePath,
    rawContent: input.content,
    errors: []
  };
}

// TODO: Orchestrate frontmatter and Markdown reference parsing for view content.
export function parseViewFile(input: ParseFileInput): ParsedViewWithErrors {
  return {
    id: '',
    group: null,
    blockRefs: [],
    filePath: input.filePath,
    relativePath: input.relativePath,
    localContent: input.content,
    errors: []
  };
}
