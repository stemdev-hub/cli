import { mkdir, rename, stat, unlink, writeFile as writeTextFile } from 'node:fs/promises';
import path from 'node:path';

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
type FsEmptyResult = { success: true } | { success: false; error: FsError };

interface WriteFileOptions {
  overwrite?: boolean;
}

const TEMP_FILE_SUFFIX = '.stem-tmp';

export async function writeFile(
  filePath: string,
  content: string,
  options: WriteFileOptions = {}
): Promise<FsEmptyResult> {
  const overwrite = options.overwrite ?? false;
  const targetPath = path.resolve(filePath);
  const tempPath = `${targetPath}${TEMP_FILE_SUFFIX}`;

  if (!overwrite) {
    const existingFileResult = await fileExists(targetPath);
    if (existingFileResult.success && existingFileResult.data) {
      return {
        success: false,
        error: {
          code: 'ALREADY_EXISTS',
          message: `File already exists: ${targetPath}. Pass overwrite: true to replace it.`,
          path: targetPath
        }
      };
    }

    if (!existingFileResult.success && existingFileResult.error.code !== 'NOT_FOUND') {
      return existingFileResult;
    }
  }

  const ensureDirResult = await ensureDir(path.dirname(targetPath));
  if (!ensureDirResult.success) {
    return ensureDirResult;
  }

  try {
    await writeTextFile(tempPath, content, 'utf8');
    await rename(tempPath, targetPath);
    return { success: true };
  } catch (error) {
    await cleanupTempFile(tempPath);

    return {
      success: false,
      error: toFsError(error, 'WRITE_FAILED', targetPath, `Failed to write file: ${targetPath}.`)
    };
  }
}

export async function ensureDir(dirPath: string): Promise<FsEmptyResult> {
  try {
    await mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: toFsError(error, 'WRITE_FAILED', dirPath, `Failed to create directory: ${dirPath}.`)
    };
  }
}

export async function deleteFile(filePath: string): Promise<FsEmptyResult> {
  const targetPath = path.resolve(filePath);

  try {
    await unlink(targetPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: toFsError(error, 'WRITE_FAILED', targetPath, `Failed to delete file: ${targetPath}.`)
    };
  }
}

async function fileExists(filePath: string): Promise<FsResult<boolean>> {
  try {
    const stats = await stat(filePath);
    return { success: true, data: stats.isFile() };
  } catch (error) {
    return {
      success: false,
      error: toFsError(error, 'NOT_FOUND', filePath, `File not found: ${filePath}.`)
    };
  }
}

async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    await unlink(tempPath);
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      return;
    }
  }
}

function toFsError(error: unknown, fallbackCode: FsErrorCode, errorPath: string, fallbackMessage: string): FsError {
  if (isNodeError(error)) {
    if (error.code === 'ENOENT') {
      return { code: 'NOT_FOUND', message: fallbackMessage, path: errorPath };
    }

    if (error.code === 'EEXIST') {
      return { code: 'ALREADY_EXISTS', message: `File already exists: ${errorPath}.`, path: errorPath };
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
