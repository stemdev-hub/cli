import path from 'node:path';

import type { InitProjectOptions, InitResult, OperationResult } from '@stem/types';
import { STEM_CONFIG_DEFAULTS, STEM_CONFIG_FILE } from '../config/index.js';
import { findProjectRoot } from '../fs/finder.js';
import { readFile } from '../fs/reader.js';
import { ensureDir, writeFile } from '../fs/writer.js';
import { fromFsError, operationError } from './errors.js';

export async function initProject(
  options: InitProjectOptions = {}
): Promise<OperationResult<InitResult>> {
  const projectRoot = path.resolve(options.startDir ?? process.cwd());
  const existingProjectResult = await findProjectRoot(projectRoot);
  if (existingProjectResult.success && path.resolve(existingProjectResult.data) !== projectRoot) {
    return {
      success: false,
      error: operationError(
        'CONFLICT',
        `Cannot initialize a nested Stem project inside ${existingProjectResult.data}.`,
        { path: projectRoot }
      )
    };
  }

  const config = {
    version: STEM_CONFIG_DEFAULTS.version,
    blocksDir: STEM_CONFIG_DEFAULTS.blocksDir,
    viewsDir: STEM_CONFIG_DEFAULTS.viewsDir,
    schemasDir: STEM_CONFIG_DEFAULTS.schemasDir,
    cacheDir: STEM_CONFIG_DEFAULTS.cacheDir
  };

  const dirResult = await ensureProjectDirs(projectRoot, config);
  if (!dirResult.success) {
    return dirResult;
  }

  const configWriteResult = await writeProjectFile(
    path.join(projectRoot, STEM_CONFIG_FILE),
    `${JSON.stringify(config, null, 2)}\n`,
    options.force ?? false
  );
  if (!configWriteResult.success) {
    return configWriteResult;
  }

  for (const schema of BUILT_IN_SCHEMAS) {
    const schemaWriteResult = await writeProjectFile(
      path.join(projectRoot, config.schemasDir, schema.fileName),
      schema.content,
      options.force ?? false
    );
    if (!schemaWriteResult.success) {
      return schemaWriteResult;
    }
  }

  const gitignoreResult = await ensureGitignoreCacheEntry(projectRoot);
  if (!gitignoreResult.success) {
    return gitignoreResult;
  }

  return {
    success: true,
    data: {
      projectRoot,
      blocksDir: path.join(projectRoot, config.blocksDir),
      viewsDir: path.join(projectRoot, config.viewsDir),
      schemasDir: path.join(projectRoot, config.schemasDir)
    }
  };
}

interface InitConfigPaths {
  blocksDir: string;
  viewsDir: string;
  schemasDir: string;
}

interface BuiltInSchema {
  fileName: string;
  content: string;
}

const GITIGNORE_CACHE_ENTRY = '.stem/cache/';

const BUILT_IN_SCHEMAS: BuiltInSchema[] = [
  {
    fileName: 'api.yaml',
    content: `name: api
required:
  - endpoint
  - request
  - response
description: API documentation must describe endpoint, request, and response details.
`
  },
  {
    fileName: 'adr.yaml',
    content: `name: adr
required:
  - context
  - decision
  - consequences
description: Architecture decision records must describe context, decision, and consequences.
`
  }
];

async function ensureProjectDirs(
  projectRoot: string,
  config: InitConfigPaths
): Promise<OperationResult<void>> {
  for (const dirPath of [
    path.join(projectRoot, '.stem'),
    path.join(projectRoot, config.blocksDir),
    path.join(projectRoot, config.viewsDir),
    path.join(projectRoot, config.schemasDir)
  ]) {
    const result = await ensureDir(dirPath);
    if (!result.success) {
      return { success: false, error: fromFsError(result.error) };
    }
  }

  return { success: true, data: undefined };
}

async function writeProjectFile(
  filePath: string,
  content: string,
  overwrite: boolean
): Promise<OperationResult<void>> {
  const result = await writeFile(filePath, content, { overwrite });
  if (result.success) {
    return { success: true, data: undefined };
  }

  return {
    success: false,
    error:
      result.error.code === 'ALREADY_EXISTS'
        ? operationError('CONFLICT', result.error.message, { path: result.error.path, cause: result.error })
        : fromFsError(result.error)
  };
}

async function ensureGitignoreCacheEntry(projectRoot: string): Promise<OperationResult<void>> {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const readResult = await readFile(gitignorePath);

  if (!readResult.success) {
    if (readResult.error.code !== 'NOT_FOUND') {
      return { success: false, error: fromFsError(readResult.error) };
    }

    return writeProjectFile(gitignorePath, `${GITIGNORE_CACHE_ENTRY}\n`, false);
  }

  if (hasGitignoreCacheEntry(readResult.data)) {
    return { success: true, data: undefined };
  }

  const separator = readResult.data.length === 0 || readResult.data.endsWith('\n') ? '' : '\n';
  return writeProjectFile(gitignorePath, `${readResult.data}${separator}${GITIGNORE_CACHE_ENTRY}\n`, true);
}

function hasGitignoreCacheEntry(content: string): boolean {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === GITIGNORE_CACHE_ENTRY || line === `/${GITIGNORE_CACHE_ENTRY}`);
}
