import { load } from 'js-yaml';

import type { OperationResult, ResolvedStemConfig, TagSchema } from '@stem/types';
import { findSchemaFiles } from '../fs/finder.js';
import { readFile } from '../fs/reader.js';
import { fromFsError, operationError } from './errors.js';

export async function loadSchemas(
  projectRoot: string,
  config: ResolvedStemConfig
): Promise<OperationResult<Map<string, TagSchema>>> {
  const schemaFilesResult = await findSchemaFiles(projectRoot, config);
  if (!schemaFilesResult.success) {
    return { success: false, error: fromFsError(schemaFilesResult.error) };
  }

  const schemas = new Map<string, TagSchema>();

  for (const filePath of schemaFilesResult.data) {
    const readResult = await readFile(filePath);
    if (!readResult.success) {
      return { success: false, error: fromFsError(readResult.error) };
    }

    const parseResult = parseSchemaFile(readResult.data, filePath);
    if (!parseResult.success) {
      return parseResult;
    }

    schemas.set(parseResult.data.name, parseResult.data);
  }

  return { success: true, data: schemas };
}

function parseSchemaFile(content: string, filePath: string): OperationResult<TagSchema> {
  let parsed: unknown;

  try {
    parsed = load(content);
  } catch (error) {
    return {
      success: false,
      error: operationError('SCHEMA_LOAD_ERROR', `Failed to parse schema YAML at ${filePath}.`, {
        path: filePath,
        cause: error
      })
    };
  }

  if (!isSchemaShape(parsed)) {
    return {
      success: false,
      error: operationError(
        'SCHEMA_LOAD_ERROR',
        `Schema file ${filePath} must define a string name and a required string array.`,
        { path: filePath }
      )
    };
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
  return (
    isPlainObject(value) &&
    typeof value['name'] === 'string' &&
    Array.isArray(value['required']) &&
    value['required'].every((entry) => typeof entry === 'string') &&
    (value['description'] === undefined || typeof value['description'] === 'string')
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
