import matter from 'gray-matter';
import type { DependencyRef, IssueContextMap, StemConfig, ValidationIssue } from '@stem/types';

export interface ParsedFrontmatter<T extends object = StemConfig> {
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

interface RawFrontmatter {
  id?: unknown;
  tags?: unknown;
  'depends-on'?: unknown;
  group?: unknown;
}

// Extract raw frontmatter without allowing malformed YAML to abort the parse pipeline.
export function parseFrontmatter<T extends object = StemConfig>(
  content: string,
  filePath = '',
  relativePath = ''
): ParsedFrontmatter<T> {
  try {
    const parsed = matter(content);
    return {
      // gray-matter intentionally returns untyped YAML data; callers choose the expected shape.
      data: parsed.data as T,
      body: parsed.content,
      errors: []
    };
  } catch (error) {
    return {
      // Malformed frontmatter has no trustworthy parsed shape, so return the requested empty shape.
      data: {} as T,
      body: stripFrontmatterBestEffort(content),
      errors: [
        createFrontmatterIssue(
          filePath,
          relativePath,
          'Frontmatter could not be parsed.',
          error instanceof Error ? error.message : String(error)
        )
      ]
    };
  }
}

export function parseBlockFrontmatter(
  content: string,
  filePath: string,
  relativePath: string
): ParsedFrontmatter<ParsedBlockFrontmatter> {
  const parsed = parseFrontmatter<RawFrontmatter>(content, filePath, relativePath);
  const errors = [...parsed.errors];
  const id =
    errors.length === 0
      ? normalizeRequiredId(parsed.data.id, filePath, relativePath, errors)
      : '';

  return {
    data: {
      id,
      tags: normalizeStringArray(parsed.data.tags),
      dependsOn: normalizeDependencyList(parsed.data['depends-on'])
    },
    body: parsed.body,
    errors
  };
}

export function parseViewFrontmatter(
  content: string,
  filePath: string,
  relativePath: string
): ParsedFrontmatter<ParsedViewFrontmatter> {
  const parsed = parseFrontmatter<RawFrontmatter>(content, filePath, relativePath);
  const errors = [...parsed.errors];
  const id =
    errors.length === 0
      ? normalizeRequiredId(parsed.data.id, filePath, relativePath, errors)
      : '';

  return {
    data: {
      id,
      group: normalizeOptionalString(parsed.data.group)
    },
    body: parsed.body,
    errors
  };
}

export function parseDependencyRef(raw: string): DependencyRef {
  const [blockIdPart = '', scopePart] = raw.split('#', 2);
  const [sectionPart, tagPart] = scopePart?.split('.', 2) ?? [];

  return {
    blockId: blockIdPart.trim(),
    section: normalizeOptionalString(sectionPart),
    tag: normalizeOptionalString(tagPart),
    raw
  };
}

function normalizeRequiredId(
  value: unknown,
  filePath: string,
  relativePath: string,
  errors: ValidationIssue[]
): string {
  const id = normalizeOptionalString(value);
  if (id !== null) {
    return id;
  }

  errors.push(
    createFrontmatterIssue(
      filePath,
      relativePath,
      'Missing required frontmatter field: id.',
      'Missing required frontmatter field: id'
    )
  );
  return '';
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function normalizeDependencyList(value: unknown): DependencyRef[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => parseDependencyRef(entry.trim()))
    : [];
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function createFrontmatterIssue(
  filePath: string,
  relativePath: string,
  message: string,
  parseError: IssueContextMap['INVALID_FRONTMATTER']['parseError']
): ValidationIssue {
  return {
    code: 'INVALID_FRONTMATTER',
    severity: 'error',
    message,
    filePath,
    relativePath,
    context: { parseError }
  };
}

function stripFrontmatterBestEffort(content: string): string {
  if (!content.startsWith('---')) {
    return content;
  }

  const closingFenceIndex = content.indexOf('\n---', 3);
  return closingFenceIndex >= 0 ? content.slice(closingFenceIndex + 4) : content;
}
