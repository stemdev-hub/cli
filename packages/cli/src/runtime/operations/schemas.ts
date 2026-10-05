import { decodeTagSchemaYaml } from '@stemdev/core';

import type { OperationResult, ResolvedStemConfig } from '../types/index.js';
import type { TagSchema } from '@stemdev/core';
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

    const parseResult = decodeTagSchemaYaml(readResult.data);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.kind === 'yaml'
          ? operationError('SCHEMA_LOAD_ERROR', `Failed to parse schema YAML at ${filePath}.`, {
            path: filePath,
            cause: parseResult.error.cause
          })
          : operationError(
            'SCHEMA_LOAD_ERROR',
            `Schema file ${filePath} must define a string name and a required string array.`,
            { path: filePath }
          )
      };
    }

    schemas.set(parseResult.data.name, parseResult.data);
  }

  return { success: true, data: schemas };
}
