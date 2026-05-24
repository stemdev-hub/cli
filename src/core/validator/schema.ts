import type { TagSchema, ValidationIssue } from '@stem/types';

// TODO: Validate tagged content against built-in and user-defined tag schemas.
export function validateSchemas(schemas: TagSchema[]): ValidationIssue[] {
  void schemas;
  throw new Error('TODO: implement schema validation.');
}
