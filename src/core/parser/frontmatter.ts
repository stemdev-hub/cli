import type { DependencyRef, ValidationIssue } from '@stem/types';

export interface ParsedFrontmatter<T> {
  data: T;
  body: string;
  errors: ValidationIssue[];
}

export interface ParsedBlockFrontmatter {
  id: string;
  tags: string[];
  dependsOn: DependencyRef[];
}

export interface ParsedViewFrontmatter {
  id: string;
  group: string | null;
}

// TODO: Extract and normalize YAML frontmatter from block and view Markdown content.
export function parseBlockFrontmatter(
  _content: string,
  _filePath: string,
  _relativePath: string
): ParsedFrontmatter<ParsedBlockFrontmatter> {
  return {
    data: { id: '', tags: [], dependsOn: [] },
    body: '',
    errors: []
  };
}

// TODO: Extract and normalize YAML frontmatter from view Markdown content.
export function parseViewFrontmatter(
  _content: string,
  _filePath: string,
  _relativePath: string
): ParsedFrontmatter<ParsedViewFrontmatter> {
  return {
    data: { id: '', group: null },
    body: '',
    errors: []
  };
}
