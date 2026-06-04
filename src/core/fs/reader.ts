import { readFile as readTextFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { FileStats } from '@stem/types';

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

export async function readFile(filePath: string): Promise<FsResult<string>> {
  try {
    const content = await readTextFile(filePath, 'utf8');
    return { success: true, data: content };
  } catch (error) {
    return {
      success: false,
      error: toFsError(error, 'READ_FAILED', filePath, `Failed to read file: ${filePath}.`)
    };
  }
}

export async function readFileStats(filePath: string): Promise<FsResult<FileStats>> {
  try {
    const stats = await stat(filePath, { bigint: true });

    return {
      success: true,
      data: {
        filePath,
        size: Number(stats.size),
        mtimeMs: Math.trunc(Number(stats.mtimeMs)),
        dev: stats.dev.toString(),
        inode: stats.ino.toString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: toFsError(error, 'READ_FAILED', filePath, `Failed to read file stats: ${filePath}.`)
    };
  }
}

export function toRelativePath(filePath: string, projectRoot: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/').replaceAll('\\', '/');
}

function toFsError(error: unknown, fallbackCode: FsErrorCode, errorPath: string, fallbackMessage: string): FsError {
  if (isNodeError(error)) {
    if (error.code === 'ENOENT') {
      return { code: 'NOT_FOUND', message: `File not found: ${errorPath}.`, path: errorPath };
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
