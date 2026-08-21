import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { fetchNamespaces } from '../../src/core/operations/fetch.js';
import type { ResolvedStemConfig, ExternalStemGraph } from '@stem/types';

const mockGraph: ExternalStemGraph = {
  version: '1',
  namespace: 'test-api',
  publishedAt: '2026-08-15T10:00:00Z',
  contentSha: 'sha256:mock',
  blocks: [],
  renames: []
};

describe('fetchNamespaces', () => {
  let testRoot: string;
  let config: ResolvedStemConfig;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-fetch-'));
    await mkdir(path.join(testRoot, '.stem', 'cache', 'namespaces'), { recursive: true });

    config = {
      version: '1',
      projectRoot: testRoot,
      blocksDir: 'blocks',
      viewsDir: 'views',
      schemasDir: 'blocks/schemas',
      cacheDir: '.stem/cache',
      namespaces: {
        'test-api': {
          graphUrl: 'https://example.com/graph.json'
        }
      }
    };

    originalFetch = global.fetch;
    global.fetch = vi.fn();
    vi.stubEnv('STEM_PUBLISH_KEY', 'mock-secret-key');
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await rm(testRoot, { recursive: true, force: true });
  });

  it('fetches and writes graph inside an envelope', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockGraph)
    });

    const result = await fetchNamespaces(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.successes).toEqual(['test-api']);
      expect(result.data.warnings).toEqual([]);
    }

    const { readFile } = await import('node:fs/promises');
    const cachedPath = path.join(testRoot, '.stem', 'cache', 'namespaces', 'test-api.json');
    const cachedContent = await readFile(cachedPath, 'utf8');
    const envelope = JSON.parse(cachedContent) as { fetchedAt: string; graph: ExternalStemGraph };

    expect(envelope.fetchedAt).toBeDefined();
    expect(envelope.graph).toEqual(mockGraph);
  });

  it('skips namespace if localPath is set and exists', async () => {
    config.namespaces['test-api']!.localPath = '../test-api-local';
    const localGraphPath = path.join(testRoot, '../test-api-local', '.stem', 'cache', 'stem-graph.json');
    await mkdir(path.dirname(localGraphPath), { recursive: true });
    await writeFile(localGraphPath, JSON.stringify(mockGraph));

    const result = await fetchNamespaces(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skipped).toEqual(['test-api']);
      expect(result.data.successes).toEqual([]);
      expect(result.data.warnings).toEqual([]);
    }

    expect(global.fetch).not.toHaveBeenCalled();
    await rm(path.join(testRoot, '../test-api-local'), { recursive: true, force: true });
  });

  it('warns and proceeds to fetch if localPath is set but missing', async () => {
    config.namespaces['test-api']!.localPath = '../missing-dir';
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockGraph)
    });

    const result = await fetchNamespaces(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.successes).toEqual(['test-api']);
      expect(result.data.warnings).toContain('Local path for namespace "test-api" not found. Falling back to graphUrl.');
    }
    expect(global.fetch).toHaveBeenCalled();
  });

  it('warns if JSON namespace does not match config key', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ...mockGraph, namespace: 'wrong-api' })
    });

    const result = await fetchNamespaces(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.successes).toEqual([]);
      expect(result.data.warnings).toContain('Downloaded JSON claims namespace "wrong-api", but configured as "test-api".');
    }
  });

  it('warns if network fetch fails', async () => {
    (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchNamespaces(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.successes).toEqual([]);
      expect(result.data.warnings).toContain('Failed to download namespace "test-api": Network error');
    }
  });
});
