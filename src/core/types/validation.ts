import type { Position } from './position.js';

// TODO: Define validation issue contracts and strongly typed diagnostic contexts.
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
  INVALID_FRONTMATTER: { parseError: string };
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
