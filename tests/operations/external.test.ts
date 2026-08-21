import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadExternalGraphs } from '../../src/core/operations/external.js';
import type { ResolvedStemConfig, ExternalStemGraph } from '@stem/types';

describe('loadExternalGraphs', () => {
  let testRoot: string;
  let config: ResolvedStemConfig;

  const mockGraph: ExternalStemGraph = {
    version: '1',
    namespace: 'test-api',
    publishedAt: '2026-08-15T10:00:00Z',
    contentSha: 'sha',
    blocks: [],
    renames: []
  };

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-external-'));
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
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('loads graph from cache envelope successfully', async () => {
    const envelope = {
      fetchedAt: '2026-08-19T10:00:00.000Z',
      graph: mockGraph
    };
    await writeFile(
      path.join(testRoot, '.stem', 'cache', 'namespaces', 'test-api.json'),
      JSON.stringify(envelope)
    );

    const result = await loadExternalGraphs(config);
    
    expect(result.size).toBe(1);
    const state = result.get('test-api');
    expect(state).toBeDefined();
    expect(state?.fetchedAt).toBe('2026-08-19T10:00:00.000Z');
    expect(state?.isLocalFallback).toBe(false);
    expect(state?.graph).toEqual(mockGraph);
  });

  it('gracefully handles legacy raw graph files (missing envelope) by ignoring them', async () => {
    // A legacy file won't have the `graph` or `fetchedAt` fields at the root
    await writeFile(
      path.join(testRoot, '.stem', 'cache', 'namespaces', 'test-api.json'),
      JSON.stringify(mockGraph) // Raw graph
    );

    const result = await loadExternalGraphs(config);
    
    // It should fail to parse the envelope and fall through to MISSING_SNAPSHOT (no entry in map)
    expect(result.has('test-api')).toBe(false);
  });

  it('gracefully handles corrupt json files', async () => {
    await writeFile(
      path.join(testRoot, '.stem', 'cache', 'namespaces', 'test-api.json'),
      '{ bad json'
    );

    const result = await loadExternalGraphs(config);
    expect(result.has('test-api')).toBe(false);
  });

  it('loads from localPath as local fallback when configured', async () => {
    config.namespaces['local-api'] = { localPath: '../local-api' };
    
    const localGraphPath = path.join(testRoot, '../local-api', '.stem', 'cache', 'stem-graph.json');
    await mkdir(path.dirname(localGraphPath), { recursive: true });
    
    // local fallback parses raw graph, NOT an envelope
    await writeFile(localGraphPath, JSON.stringify(mockGraph));

    const result = await loadExternalGraphs(config);
    
    const state = result.get('local-api');
    expect(state).toBeDefined();
    expect(state?.isLocalFallback).toBe(true);
    expect(state?.graph).toEqual(mockGraph);

    // cleanup outside testRoot
    await rm(path.join(testRoot, '../local-api'), { recursive: true, force: true });
  });
});
