import { randomUUID } from 'node:crypto';
import { link, mkdir, open, rename, unlink } from 'node:fs/promises';
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

type FsEmptyResult = { success: true } | { success: false; error: FsError };

interface WriteFileOptions {
  overwrite?: boolean;
}

export async function writeFile(
  filePath: string,
  content: string,
  options: WriteFileOptions = {}
): Promise<FsEmptyResult> {
  const overwrite = options.overwrite ?? false;
  const targetPath = path.resolve(filePath);
  const tempPath = `${targetPath}.${randomUUID()}.stem-tmp`;
  let ownsTempFile = false;

  const ensureDirResult = await ensureDir(path.dirname(targetPath));
  if (!ensureDirResult.success) {
    return ensureDirResult;
  }

  try {
    const file = await open(tempPath, 'wx');
    ownsTempFile = true;
    try {
      await file.writeFile(content, 'utf8');
    } finally {
      await file.close();
    }

    if (overwrite) {
      await rename(tempPath, targetPath);
      ownsTempFile = false;
    } else {
      // Linking the prepared file fails if the destination appeared meanwhile.
      // Do not fall back to a rename or copy that could overwrite that file.
      await link(tempPath, targetPath);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: toFsError(error, 'WRITE_FAILED', targetPath, `Failed to write file: ${targetPath}.`)
    };
  } finally {
    // Cleanup is best-effort; failure cannot undo a confirmed publication or
    // replace the original preparation/publication error. Never unlink a path
    // whose exclusive creation failed or whose file was already renamed away.
    if (ownsTempFile) await cleanupTempFile(tempPath);
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
