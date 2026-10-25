import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { InitProjectOptions, InitResult, OperationResult } from '../types/index.js';
import { STEM_CONFIG_DEFAULTS, STEM_CONFIG_FILE } from '@stemdev/core';
import { loadStemConfig, resolveStemConfig } from '../config/index.js';
import { findProjectRoot } from '../fs/finder.js';
import { readFile } from '../fs/reader.js';
import { ensureDir, writeFile } from '../fs/writer.js';
import { fromConfigError, fromFsError, operationError } from './errors.js';

export async function initProject(
  options: InitProjectOptions = {}
): Promise<OperationResult<InitResult>> {
  const projectRoot = path.resolve(options.startDir ?? process.cwd());
  const existingProjectResult = await findProjectRoot(projectRoot);
  if (!existingProjectResult.success && existingProjectResult.error.code !== 'NO_PROJECT_ROOT') {
    return { success: false, error: fromFsError(existingProjectResult.error) };
  }
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

  const configPath = path.join(projectRoot, STEM_CONFIG_FILE);
  let configResult = await loadStemConfig(projectRoot);
  if (configResult.success) {
    if (!options.force) {
      return { success: false, error: operationError('CONFLICT', `File already exists: ${configPath}.`, { path: configPath }) };
    }
  } else {
    if (configResult.error.code !== 'CONFIG_NOT_FOUND') {
      return { success: false, error: fromConfigError(configResult.error) };
    }
    let projectId: string;
    try {
      projectId = randomUUID();
    } catch (cause) {
      return { success: false, error: operationError('FS_ERROR', 'Failed to generate project identity.', { path: configPath, cause }) };
    }
    const raw = { projectId, ...STEM_CONFIG_DEFAULTS };
    configResult = resolveStemConfig(raw, projectRoot);
    if (!configResult.success) {
      return { success: false, error: fromConfigError(configResult.error) };
    }
    // Force never replaces identity, including a concurrent creator's configuration.
    const written = await writeProjectFile(configPath, `${JSON.stringify(raw, null, 2)}\n`, false);
    if (!written.success) return written;
  }
  const config = configResult.data;

  const dirResult = await ensureProjectDirs(projectRoot, config);
  if (!dirResult.success) {
    return dirResult;
  }

  const gitignoreResult = await ensureGitignoreCacheEntry(projectRoot, config.cacheDir);
  if (!gitignoreResult.success) {
    return gitignoreResult;
  }

  return {
    success: true,
    data: {
      projectRoot,
      blocksDir: path.join(projectRoot, config.blocksDir),
      viewsDir: path.join(projectRoot, config.viewsDir)
    }
  };
}

interface InitConfigPaths {
  blocksDir: string;
  viewsDir: string;
}

async function ensureProjectDirs(
  projectRoot: string,
  config: InitConfigPaths
): Promise<OperationResult<void>> {
  for (const dirPath of [
    path.join(projectRoot, '.stem'),
    path.join(projectRoot, config.blocksDir),
    path.join(projectRoot, config.viewsDir)
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

async function ensureGitignoreCacheEntry(projectRoot: string, cacheDir: string): Promise<OperationResult<void>> {
  const entries = [`${cacheDir}/`, 'rendered/'];
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const readResult = await readFile(gitignorePath);

  if (!readResult.success) {
    if (readResult.error.code !== 'NOT_FOUND') {
      return { success: false, error: fromFsError(readResult.error) };
    }

    return writeProjectFile(gitignorePath, `${entries.join('\n')}\n`, false);
  }

  const missingEntries = entries.filter((entry) => !hasGitignoreEntry(readResult.data, entry));
  if (missingEntries.length === 0) {
    return { success: true, data: undefined };
  }

  const separator = readResult.data.length === 0 || readResult.data.endsWith('\n') ? '' : '\n';
  return writeProjectFile(gitignorePath, `${readResult.data}${separator}${missingEntries.join('\n')}\n`, true);
}

function hasGitignoreEntry(content: string, entry: string): boolean {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === entry || line === `/${entry}`);
}
