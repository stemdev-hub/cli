import type { StemGraph, ValidationIssue } from '@stem/types';

// TODO: Validate IDs, references, duplicate tags, cycles, orphan blocks, and frontmatter.
export function validateRules(graph: StemGraph): ValidationIssue[] {
  void graph;
  throw new Error('TODO: implement validation rules.');
}
