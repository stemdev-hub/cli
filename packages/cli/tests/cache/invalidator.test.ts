import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CacheIndexEntry, DiscoveredFile, FileStats } from '../../src/core/types/index.js';
import { computeFileSha256, runInvalidation } from '../../src/core/cache/invalidator.js';
import { createEmptyCacheIndex, upsertCacheEntry } from '../../src/core/cache/index-store.js';

describe('invalidator', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-cache-invalidator-'));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('runInvalidation marks new files as added', async () => {
    const file = createDiscoveredFile(testRoot, 'blocks/a.md');
    const stats = createStats(file.filePath);

    const result = await runInvalidation([file], new Map([[file.relativePath, stats]]), createEmptyCacheIndex());

    expect(result.added).toEqual([{ ...file, stats }]);
    expect(result.changed).toEqual([]);
  });

  it('runInvalidation marks removed cache entries as deleted with the full entry', async () => {
    const entry = createEntry(testRoot, 'blocks/deleted.md');
    const index = upsertCacheEntry(createEmptyCacheIndex(), entry);

    const result = await runInvalidation([], new Map(), index);

    expect(result.deleted).toEqual([entry]);
  });

  it('runInvalidation marks stat-identical files as unchanged without reading SHA', async () => {
    const file = createDiscoveredFile(testRoot, 'blocks/a.md');
    const stats = createStats(file.filePath);
    const cached = createEntry(testRoot, file.relativePath, stats, 'cached-sha');
    const index = upsertCacheEntry(createEmptyCacheIndex(), cached);

    const result = await runInvalidation([file], new Map([[file.relativePath, stats]]), index);

    expect(result.unchanged).toEqual([{ ...file, stats, cached }]);
    expect(result.unchanged[0]?.sha256).toBeUndefined();
  });

  it('runInvalidation marks stat-changed SHA-different files as changed', async () => {
    const file = await writeProjectFile(testRoot, 'blocks/a.md', 'new content');
    const stats = createStats(file.filePath, { size: 11 });
    const cached = createEntry(testRoot, file.relativePath, createStats(file.filePath, { size: 3 }), 'old-sha');
    const index = upsertCacheEntry(createEmptyCacheIndex(), cached);

    const result = await runInvalidation([file], new Map([[file.relativePath, stats]]), index);

    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]?.relativePath).toBe('blocks/a.md');
  });

  it('runInvalidation marks stat-changed SHA-same files as metadataChanged', async () => {
    const file = await writeProjectFile(testRoot, 'blocks/a.md', 'same content');
    const sha256 = sha('same content');
    const stats = createStats(file.filePath, { mtimeMs: 10.9 });
    const cached = createEntry(testRoot, file.relativePath, createStats(file.filePath, { mtimeMs: 9 }), sha256);
    const index = upsertCacheEntry(createEmptyCacheIndex(), cached);

    const result = await runInvalidation([file], new Map([[file.relativePath, stats]]), index);

    expect(result.metadataChanged).toHaveLength(1);
    expect(result.metadataChanged[0]?.sha256).toBe(sha256);
  });

  it('runInvalidation includes SHA in the result for changed files', async () => {
    const file = await writeProjectFile(testRoot, 'blocks/a.md', 'new content');
    const stats = createStats(file.filePath, { size: 11 });
    const cached = createEntry(testRoot, file.relativePath, createStats(file.filePath, { size: 3 }), 'old-sha');
    const index = upsertCacheEntry(createEmptyCacheIndex(), cached);

    const result = await runInvalidation([file], new Map([[file.relativePath, stats]]), index);

    expect(result.changed[0]?.sha256).toBe(sha('new content'));
  });

  it('runInvalidation includes SHA in the result for metadataChanged files', async () => {
    const file = await writeProjectFile(testRoot, 'blocks/a.md', 'same content');
    const sha256 = sha('same content');
    const stats = createStats(file.filePath, { dev: 'new-device' });
    const cached = createEntry(testRoot, file.relativePath, createStats(file.filePath), sha256);
    const index = upsertCacheEntry(createEmptyCacheIndex(), cached);

    const result = await runInvalidation([file], new Map([[file.relativePath, stats]]), index);

    expect(result.metadataChanged[0]?.sha256).toBe(sha256);
  });

  it('runInvalidation does not include SHA in the result for unchanged files', async () => {
    const file = createDiscoveredFile(testRoot, 'blocks/a.md');
    const stats = createStats(file.filePath);
    const index = upsertCacheEntry(createEmptyCacheIndex(), createEntry(testRoot, file.relativePath, stats));

    const result = await runInvalidation([file], new Map([[file.relativePath, stats]]), index);

    expect(result.unchanged[0]?.sha256).toBeUndefined();
  });

  it('runInvalidation uses integer mtimeMs comparison', async () => {
    const file = createDiscoveredFile(testRoot, 'blocks/a.md');
    const stats = createStats(file.filePath, { mtimeMs: 4.9 });
    const cached = createEntry(testRoot, file.relativePath, createStats(file.filePath, { mtimeMs: 4 }));
    const index = upsertCacheEntry(createEmptyCacheIndex(), cached);

    const result = await runInvalidation([file], new Map([[file.relativePath, stats]]), index);

    expect(result.unchanged).toHaveLength(1);
  });

  it('computeFileSha256 returns lowercase hex SHA-256', async () => {
    const file = await writeProjectFile(testRoot, 'blocks/a.md', 'content');

    const result = await computeFileSha256(file.filePath);

    expect(result).toEqual({ success: true, data: sha('content') });
  });

  it('computeFileSha256 returns CACHE_HASH_FAILED for a missing file', async () => {
    const filePath = path.join(testRoot, 'missing.md');

    const result = await computeFileSha256(filePath);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CACHE_HASH_FAILED');
      expect(result.error.path).toBe(filePath);
    }
  });
});

function createDiscoveredFile(projectRoot: string, relativePath: string): DiscoveredFile {
  return {
    filePath: path.join(projectRoot, ...relativePath.split('/')),
    relativePath,
    type: 'block'
  };
}

async function writeProjectFile(projectRoot: string, relativePath: string, content: string): Promise<DiscoveredFile> {
  const file = createDiscoveredFile(projectRoot, relativePath);
  await mkdir(path.dirname(file.filePath), { recursive: true });
  await writeFile(file.filePath, content, 'utf8');
  return file;
}

function createStats(filePath: string, overrides: Partial<FileStats> = {}): FileStats {
  return {
    filePath,
    size: 3,
    mtimeMs: 4,
    dev: '1',
    inode: '2',
    ...overrides
  };
}

function createEntry(
  projectRoot: string,
  relativePath: string,
  stats: FileStats = createStats(path.join(projectRoot, ...relativePath.split('/'))),
  sha256: string = 'cached-sha'
): CacheIndexEntry {
  return {
    filePath: stats.filePath,
    relativePath,
    type: 'block',
    dev: stats.dev,
    inode: stats.inode,
    size: stats.size,
    mtimeMs: Math.trunc(stats.mtimeMs),
    sha256,
    parsed: {
      id: 'auth-block',
      tags: [],
      dependsOn: [],
      sections: [],
      standaloneTags: []
    }
  };
}

function sha(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
