import { load } from 'js-yaml';
import type { TagSchema } from '../types/schema.js';

export type TagSchemaDecodeResult =
  | { success: true; data: TagSchema }
  | { success: false; error: { kind: 'yaml'; cause: unknown } | { kind: 'shape' } };

/** Decode schema text without I/O; callers add file context to failures. */
export function decodeTagSchemaYaml(content: string): TagSchemaDecodeResult {
  let parsed: unknown;
  try {
    parsed = load(content);
  } catch (cause) {
    return { success: false, error: { kind: 'yaml', cause } };
  }

  if (!isSchemaShape(parsed)) {
    return { success: false, error: { kind: 'shape' } };
  }

  return {
    success: true,
    data: {
      name: parsed.name,
      required: [...parsed.required],
      ...(parsed.description === undefined ? {} : { description: parsed.description })
    }
  };
}

function isSchemaShape(value: unknown): value is TagSchema {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const schema = value as Record<string, unknown>;
  return (
    typeof schema['name'] === 'string' &&
    Array.isArray(schema['required']) &&
    schema['required'].every((entry) => typeof entry === 'string') &&
    (schema['description'] === undefined || typeof schema['description'] === 'string')
  );
}
