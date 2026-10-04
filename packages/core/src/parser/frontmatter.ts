import { CORE_SCHEMA, load, mergeTag, timestampTag } from 'js-yaml';
import type { DependencyRef, IssueContextMap, StemConfig, ValidationIssue } from '../types/index.js';

// Timestamp values must remain non-strings when normalizing Stem fields.
const FRONTMATTER_SCHEMA = CORE_SCHEMA.withTags(mergeTag, timestampTag);

export interface ParsedFrontmatter<T extends object = StemConfig> {
  data: T;
  body: string;
  bodyStartLine: number;
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
    const parsed = splitYamlFrontmatter(content);
    return {
      // YAML can be a scalar or array; callers choose the expected shape.
      data: parsed.data as T,
      body: parsed.content,
      bodyStartLine: getBodyStartLine(content, parsed.content),
      errors: []
    };
  } catch (error) {
    const body = stripFrontmatterBestEffort(content);
    return {
      // Malformed frontmatter has no trustworthy parsed shape, so return the requested empty shape.
      data: {} as T,
      body,
      bodyStartLine: getBodyStartLine(content, body),
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

function splitYamlFrontmatter(content: string): { data: unknown; content: string } {
  const source = content.replace(/^\uFEFF/, '');
  if (!source.startsWith('---') || source[3] === '-') {
    return { data: {}, content: source };
  }

  let yaml = source.slice(3);
  const languageLine = yaml.slice(0, yaml.search(/\r?\n/));
  const language = languageLine.trim().toLowerCase();
  if (language.length > 0) {
    if (language !== 'yaml' && language !== 'yml') {
      throw new Error(`Unsupported frontmatter language "${languageLine.trim()}". Only YAML is supported.`);
    }
    yaml = yaml.slice(languageLine.length);
  }

  // Preserve prefix matching of closing fences and the successful-parse newline removal.
  const closingIndex = yaml.indexOf('\n---');
  const raw = closingIndex < 0 ? yaml : yaml.slice(0, closingIndex);
  const empty = raw.replace(/^\s*#[^\n]*/gm, '').trim().length === 0;
  const data: unknown = empty ? {} : load(raw, { schema: FRONTMATTER_SCHEMA });
  let body = closingIndex < 0 ? '' : yaml.slice(closingIndex + 4);
  if (body.startsWith('\r')) body = body.slice(1);
  if (body.startsWith('\n')) body = body.slice(1);
  return { data: data ?? {}, content: body };
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
    bodyStartLine: parsed.bodyStartLine,
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
    bodyStartLine: parsed.bodyStartLine,
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

function getBodyStartLine(content: string, body: string): number {
  const prefixLength = Math.max(0, content.length - body.length);
  const prefix = content.slice(0, prefixLength);
  return [...prefix].filter((character) => character === '\n').length + 1;
}
