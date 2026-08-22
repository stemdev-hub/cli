import type { Position } from './position.js';

export type IssueSeverity = 'error' | 'warning';

export interface IssueContextMap {
  DUPLICATE_ID: { id: string; collidingFilePath: string };
  BROKEN_BLOCK_REF: { targetId: string; rawRef: string };
  BROKEN_SECTION_REF: { targetId: string; targetSection: string };
  EXTERNAL_TAG_MISSING_SECTION: { tagName: string; sectionName: string };
  CROSS_BLOCK_SECTION_REF: { sourceBlockId: string; targetBlockId: string };
  CIRCULAR_DEPENDENCY: { dependencyChain: string };
  SCHEMA_VIOLATION: { tagName: string; missingSections: string };
  ORPHANED_BLOCK: { blockId: string };
  DUPLICATE_TAG_IN_SECTION: { tagName: string; sectionName: string };
  UNRESOLVED_TAG: { targetId: string; targetSection: string; missingTag: string };
  INVALID_BLOCK_REF_FILTER: { targetId: string; rawRef: string };
  INVALID_FRONTMATTER: { parseError: string };
  INVALID_STEM_PARAMETER: { rawRef: string; reason: string };
  MISSING_BLOCK_VARIABLE: {
    blockId: string;
    variableName: string;
    rawRef: string;
    viewPath: string;
    viewLine: number;
    viewColumn: number;
  };
  INLINE_BLOCK_REFERENCE: { blockId: string; rawRef: string };
  BLOCK_REFERENCE_IN_TABLE_CELL: { blockId: string; rawRef: string };
  UNRESOLVED_NAMESPACE: { namespace: string; rawRef: string };
  MISSING_SNAPSHOT: { namespace: string; rawRef: string };
  EXPIRED_SNAPSHOT: { namespace: string; rawRef: string; fetchedAt: string };
}

export type ValidationIssue = {
  [K in keyof IssueContextMap]: Readonly<{
    code: K;
    severity: IssueSeverity;
    message: string;
    filePath: string;
    relativePath: string;
    position?: Position;
    context: IssueContextMap[K];
  }>;
}[keyof IssueContextMap];

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}
