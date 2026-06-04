import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GraphSnapshot, ResolvedStemConfig } from '../../src/core/types/index.js';
import {
  createEmptyGraphSnapshot,
  GRAPH_SNAPSHOT_VERSION,
  readGraphSnapshot,
  writeGraphSnapshot
} from '../../src/core/cache/graph-store.js';

describe('graph-store', () => {
  let testRoot: string;
  let config: ResolvedStemConfig;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-cache-graph-'));
    config = createConfig(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('readGraphSnapshot returns null when the graph file is missing', async () => {
    const result = await readGraphSnapshot(testRoot, config);

    expect(result).toEqual({ success: true, data: null });
  });

  it('readGraphSnapshot returns CACHE_INVALID_JSON for invalid JSON', async () => {
    await writeCacheFile(testRoot, config, 'graph.json', '{ broken json');

    const result = await readGraphSnapshot(testRoot, config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CACHE_INVALID_JSON');
    }
  });

  it('readGraphSnapshot returns null for an unsupported version', async () => {
    await writeCacheFile(testRoot, config, 'graph.json', JSON.stringify({ ...createSnapshot(), version: '999' }));

    const result = await readGraphSnapshot(testRoot, config);

    expect(result).toEqual({ success: true, data: null });
  });

  it('readGraphSnapshot returns a valid snapshot from disk', async () => {
    const snapshot = createSnapshot();
    await writeCacheFile(testRoot, config, 'graph.json', JSON.stringify(snapshot));

    const result = await readGraphSnapshot(testRoot, config);

    expect(result).toEqual({ success: true, data: snapshot });
  });

  it('writeGraphSnapshot creates the cache directory when missing', async () => {
    const snapshot = createSnapshot();

    const result = await writeGraphSnapshot(testRoot, config, snapshot);

    expect(result).toEqual({ success: true, data: undefined });
    await expect(readFile(path.join(testRoot, config.cacheDir, 'graph.json'), 'utf8')).resolves.toContain('"nodes"');
  });

  it('writeGraphSnapshot writes correct JSON to disk', async () => {
    const snapshot = createSnapshot();

    const result = await writeGraphSnapshot(testRoot, config, snapshot);

    expect(result).toEqual({ success: true, data: undefined });
    await expect(readFile(path.join(testRoot, config.cacheDir, 'graph.json'), 'utf8')).resolves.toBe(
      `${JSON.stringify(snapshot, null, 2)}\n`
    );
  });

  it('createEmptyGraphSnapshot returns the current version and empty graph collections', () => {
    expect(createEmptyGraphSnapshot()).toEqual({
      version: GRAPH_SNAPSHOT_VERSION,
      generatedAt: '',
      nodes: [],
      edges: [],
      blockUsedInViews: {},
      viewUsesBlocks: {},
      blockDependsOn: {},
      blockDependents: {}
    });
  });
});

function createConfig(projectRoot: string): ResolvedStemConfig {
  return {
    version: '1',
    projectRoot,
    blocksDir: 'blocks',
    viewsDir: 'views',
    schemasDir: 'blocks/schemas',
    cacheDir: '.stem/cache'
  };
}

function createSnapshot(): GraphSnapshot {
  return {
    version: GRAPH_SNAPSHOT_VERSION,
    generatedAt: '2026-06-04T00:00:00.000Z',
    nodes: [
      {
        id: 'auth-block',
        type: 'block',
        filePath: '/project/blocks/auth.md',
        relativePath: 'blocks/auth.md',
        tags: ['auth'],
        group: null
      }
    ],
    edges: [],
    blockUsedInViews: {},
    viewUsesBlocks: {},
    blockDependsOn: {},
    blockDependents: {}
  };
}

async function writeCacheFile(
  projectRoot: string,
  config: ResolvedStemConfig,
  fileName: string,
  content: string
): Promise<void> {
  const filePath = path.join(projectRoot, config.cacheDir, fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}
