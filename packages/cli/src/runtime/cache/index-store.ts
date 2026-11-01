import path from 'node:path';
import type { CacheIndex, ResolvedStemConfig } from '../types/index.js';
import { writeFile } from '../fs/writer.js';
import { cacheError } from './errors.js';
import type { CacheResult } from './errors.js';
export const CACHE_VERSION = '3';
export async function writeCacheIndex(
  root: string,
  config: ResolvedStemConfig,
  data: CacheIndex
): Promise<CacheResult<void>> {
  const file = path.join(root, config.cacheDir, 'index.json');
  const result = await writeFile(file, JSON.stringify(data, null, 2) + '\n', { overwrite: true });
  return result.success
    ? { success: true, data: undefined }
    : { success: false, error: cacheError('CACHE_WRITE_FAILED', result.error.message, file) };
}
