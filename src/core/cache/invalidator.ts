import { createHash } from 'node:crypto';

import type {
  CacheIndex,
  CacheInvalidationResult,
  DiscoveredFile,
  FileInvalidation,
  FileStats
} from '@stem/types';
import { readFile } from '../fs/reader.js';
import { cacheError } from './errors.js';
import type { CacheResult } from './errors.js';

export async function computeFileSha256(filePath: string): Promise<CacheResult<string>> {
  const readResult = await readFile(filePath);

  if (!readResult.success) {
    return {
      success: false,
      error: cacheError('CACHE_HASH_FAILED', `Failed to hash file content at ${filePath}.`, filePath)
    };
  }

  return {
    success: true,
    data: createHash('sha256').update(readResult.data, 'utf8').digest('hex')
  };
}

export async function runInvalidation(
  discovered: DiscoveredFile[],
  currentStats: Map<string, FileStats>,
  existingIndex: CacheIndex
): Promise<CacheInvalidationResult> {
  const result: CacheInvalidationResult = {
    added: [],
    changed: [],
    unchanged: [],
    metadataChanged: [],
    deleted: []
  };
  const discoveredPaths = new Set(discovered.map((file) => file.relativePath));

  for (const file of discovered) {
    const stats = currentStats.get(file.relativePath);

    if (stats === undefined) {
      result.changed.push(createMissingStatsInvalidation(file));
      continue;
    }

    const cached = existingIndex.entries[file.relativePath];
    if (cached === undefined) {
      result.added.push(createInvalidation(file, stats));
      continue;
    }

    if (statsMatch(stats, cached)) {
      result.unchanged.push(createInvalidation(file, stats, cached));
      continue;
    }

    const shaResult = await computeFileSha256(file.filePath);
    if (!shaResult.success) {
      result.changed.push(createInvalidation(file, stats, cached));
      continue;
    }

    const invalidation = createInvalidation(file, stats, cached, shaResult.data);
    if (shaResult.data === cached.sha256) {
      result.metadataChanged.push(invalidation);
    } else {
      result.changed.push(invalidation);
    }
  }

  for (const [relativePath, entry] of Object.entries(existingIndex.entries)) {
    if (!discoveredPaths.has(relativePath)) {
      result.deleted.push(entry);
    }
  }

  return result;
}

function createInvalidation(
  file: DiscoveredFile,
  stats: FileStats,
  cached?: FileInvalidation['cached'],
  sha256?: string
): FileInvalidation {
  return {
    filePath: file.filePath,
    relativePath: file.relativePath,
    type: file.type,
    stats: {
      ...stats,
      mtimeMs: Math.trunc(stats.mtimeMs)
    },
    ...(sha256 === undefined ? {} : { sha256 }),
    ...(cached === undefined ? {} : { cached })
  };
}

function createMissingStatsInvalidation(file: DiscoveredFile): FileInvalidation {
  return {
    filePath: file.filePath,
    relativePath: file.relativePath,
    type: file.type,
    stats: {
      filePath: file.filePath,
      size: 0,
      mtimeMs: 0,
      dev: '',
      inode: ''
    }
  };
}

function statsMatch(stats: FileStats, cached: FileInvalidation['cached']): boolean {
  return (
    cached !== undefined &&
    stats.dev === cached.dev &&
    stats.inode === cached.inode &&
    stats.size === cached.size &&
    Math.trunc(stats.mtimeMs) === cached.mtimeMs
  );
}
