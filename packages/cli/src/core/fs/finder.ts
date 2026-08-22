import { stat } from 'node:fs/promises';
import path from 'node:path';

import fastGlob from 'fast-glob';

import type { ResolvedStemConfig } from '@stem/types';

export type FsErrorCode =
  | 'NOT_FOUND'
  | 'NO_PROJECT_ROOT'
  | 'PERMISSION_DENIED'
  | 'ALREADY_EXISTS'
  | 'WRITE_FAILED'
  | 'READ_FAILED';

export interface FsError {
  code: FsErrorCode;
  message: string;
  path: string;
}

type FsResult<T> = { success: true; data: T } | { success: false; error: FsError };

const STEM_DIR = '.stem';
const MARKDOWN_PATTERN = '**/*.md';
const SCHEMA_PATTERN = '**/*.{yaml,yml}';
const IGNORED_DIRECTORIES = ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/.stem/cache/**', '**/.*/**'];

export async function findProjectRoot(startDir: string): Promise<FsResult<string>> {
  let currentDir = path.resolve(startDir);

  while (true) {
    const stemDir = path.join(currentDir, STEM_DIR);
    const stemDirResult = await directoryExists(stemDir);

    if (stemDirResult.success && stemDirResult.data) {
      return { success: true, data: currentDir };
    }

    if (!stemDirResult.success && stemDirResult.error.code !== 'NOT_FOUND') {
      return stemDirResult;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return {
        success: false,
        error: {
          code: 'NO_PROJECT_ROOT',
          message: `No Stem project root found from ${path.resolve(startDir)}. Expected a .stem directory in this folder or one of its parents.`,
          path: path.resolve(startDir)
        }
      };
    }

    currentDir = parentDir;
  }
}

export async function findBlockFiles(
  projectRoot: string,
  config: ResolvedStemConfig
): Promise<FsResult<string[]>> {
  const blocksDir = path.join(projectRoot, config.blocksDir);
  const schemasDirName = toPosixPath(path.relative(blocksDir, path.join(projectRoot, config.schemasDir)));
  const ignore = [...IGNORED_DIRECTORIES, `${schemasDirName}/**`];

  return scanFiles(blocksDir, projectRoot, [MARKDOWN_PATTERN], ignore);
}

export async function findViewFiles(
  projectRoot: string,
  config: ResolvedStemConfig
): Promise<FsResult<string[]>> {
  return scanFiles(path.join(projectRoot, config.viewsDir), projectRoot, [MARKDOWN_PATTERN], IGNORED_DIRECTORIES);
}

export async function findSchemaFiles(
  projectRoot: string,
  config: ResolvedStemConfig
): Promise<FsResult<string[]>> {
  return scanFiles(path.join(projectRoot, config.schemasDir), projectRoot, [SCHEMA_PATTERN], IGNORED_DIRECTORIES);
}

async function scanFiles(
  cwd: string,
  projectRoot: string,
  patterns: string[],
  ignore: string[]
): Promise<FsResult<string[]>> {
  try {
    const entries = await fastGlob(patterns, {
      cwd,
      absolute: true,
      onlyFiles: true,
      unique: true,
      ignore,
      dot: false
    });

    const sorted = entries
      .map((entry) => path.resolve(entry))
      .sort((left, right) => compareByRelativePath(left, right, projectRoot));

    return { success: true, data: sorted };
  } catch (error) {
    return {
      success: false,
      error: toFsError(error, 'READ_FAILED', cwd, `Failed to scan files in ${cwd}.`)
    };
  }
}

async function directoryExists(dirPath: string): Promise<FsResult<boolean>> {
  try {
    const stats = await stat(dirPath);
    return { success: true, data: stats.isDirectory() };
  } catch (error) {
    return {
      success: false,
      error: toFsError(error, 'NOT_FOUND', dirPath, `Directory not found: ${dirPath}.`)
    };
  }
}

function compareByRelativePath(left: string, right: string, projectRoot: string): number {
  return toPosixPath(path.relative(projectRoot, left)).localeCompare(toPosixPath(path.relative(projectRoot, right)));
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/').replaceAll('\\', '/');
}

function toFsError(error: unknown, fallbackCode: FsErrorCode, errorPath: string, fallbackMessage: string): FsError {
  if (isNodeError(error)) {
    if (error.code === 'ENOENT') {
      return { code: 'NOT_FOUND', message: fallbackMessage, path: errorPath };
    }

    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return { code: 'PERMISSION_DENIED', message: `Permission denied: ${errorPath}.`, path: errorPath };
    }
  }

  return { code: fallbackCode, message: fallbackMessage, path: errorPath };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
