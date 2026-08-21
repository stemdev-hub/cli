import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { publishGraph } from '../../src/core/operations/publish.js';
import type { ResolvedStemConfig, ExternalStemGraph } from '@stem/types';

describe('publishGraph', () => {
  let testRoot: string;
  let config: ResolvedStemConfig;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-publish-'));
    await mkdir(path.join(testRoot, '.stem'), { recursive: true });
    await mkdir(path.join(testRoot, 'blocks'), { recursive: true });
    await mkdir(path.join(testRoot, 'views'), { recursive: true });

    config = {
      version: '1',
      namespace: 'my-api',
      publishUrl: 'https://example.com/graph.json',
      projectRoot: testRoot,
      blocksDir: 'blocks',
      viewsDir: 'views',
      schemasDir: 'blocks/schemas',
      cacheDir: '.stem/cache',
      namespaces: {}
    };

    originalFetch = global.fetch;
    global.fetch = vi.fn();
    
    vi.stubEnv('STEM_PUBLISH_KEY', 'mock-secret-key');
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    await rm(testRoot, { recursive: true, force: true });
  });

  it('builds graph, generates SHA, and uploads successfully', async () => {
    await writeFile(
      path.join(testRoot, 'blocks/api.md'),
      `---
id: api-block
tags: [api, core]
---
@stem[section:endpoints]
@stem[tag:list]
Content
@stem[end]
@stem[end]
`
    );

    await writeFile(
      path.join(testRoot, '.stem/renames.json'),
      JSON.stringify([
        { from: 'old-api', to: 'api-block', since: new Date().toISOString() }
      ])
    );

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'OK'
    });

    const result = await publishGraph(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.namespace).toBe('my-api');
      expect(result.data.uploadedTo).toBe('https://example.com/graph.json');
    }

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = (global.fetch as Mock).mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(fetchCall).toBeDefined();
    expect(fetchCall[0]).toBe('https://example.com/graph.json');
    expect(fetchCall[1].method).toBe('PUT');
    expect(fetchCall[1].headers['Authorization']).toBe('Bearer mock-secret-key');
    
    const payload = JSON.parse(fetchCall[1].body) as ExternalStemGraph;
    expect(payload.version).toBe('1');
    expect(payload.namespace).toBe('my-api');
    expect(payload.contentSha).toBeDefined();
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]?.id).toBe('api-block');
    expect(payload.blocks[0]?.tags).toEqual(['api', 'core']);
    expect(payload.blocks[0]?.sections).toHaveLength(1);
    expect(payload.blocks[0]?.sections[0]?.id).toBe('endpoints');
    expect(payload.blocks[0]?.sections[0]?.tags).toEqual(['list']);
    expect(payload.renames).toHaveLength(1);
  });

  it('prunes renames older than 90 days', async () => {
    await writeFile(path.join(testRoot, 'blocks/api.md'), '---\nid: api-block\n---\n');
    
    const oldDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const newDate = new Date().toISOString();
    
    await writeFile(
      path.join(testRoot, '.stem/renames.json'),
      JSON.stringify([
        { from: 'too-old', to: 'api-block', since: oldDate },
        { from: 'recent', to: 'api-block', since: newDate }
      ])
    );

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'OK'
    });

    await publishGraph(config);

    const fetchCall2 = (global.fetch as Mock).mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(fetchCall2).toBeDefined();
    const payload = JSON.parse(fetchCall2[1].body) as ExternalStemGraph;
    expect(payload.renames).toHaveLength(1);
    expect(payload.renames[0]?.from).toBe('recent');
  });

  it('returns an error if namespace is not defined in config', async () => {
    delete config.namespace;
    const result = await publishGraph(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_OPERATION');
      expect(result.error.message).toContain('Project identity is missing');
    }
  });

  it('returns an error if network fetch fails', async () => {
    await writeFile(path.join(testRoot, 'blocks/api.md'), '---\nid: api-block\n---\n');

    (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await publishGraph(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.message).toContain('Failed to upload graph to');
    }
  });
});
