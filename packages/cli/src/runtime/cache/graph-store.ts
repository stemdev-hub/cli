import path from 'node:path';
import type { GraphSnapshot, ResolvedStemConfig } from '../types/index.js';
import { writeFile } from '../fs/writer.js';
import { cacheError } from './errors.js';
import type { CacheResult } from './errors.js';
export const GRAPH_SNAPSHOT_VERSION = '2';
export async function writeGraphSnapshot(
  root: string,
  config: ResolvedStemConfig,
  data: GraphSnapshot
): Promise<CacheResult<void>> {
  const file = path.join(root, config.cacheDir, 'graph.json');
  const result = await writeFile(file, JSON.stringify(data, null, 2) + '\n', { overwrite: true });
  return result.success
    ? { success: true, data: undefined }
    : { success: false, error: cacheError('CACHE_WRITE_FAILED', result.error.message, file) };
}
