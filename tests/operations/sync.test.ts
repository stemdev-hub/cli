import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readGraphSnapshot } from '../../src/core/cache/graph-store.js';
import { readCacheIndex } from '../../src/core/cache/index-store.js';
import { syncProject } from '../../src/core/operations/sync.js';
import type { ResolvedStemConfig } from '../../src/core/types/index.js';

describe('syncProject', () => {
  let testRoot: string;
  let config: ResolvedStemConfig;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-sync-'));
    config = createConfig(testRoot);
    await createStemProject(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('writes the cache index and graph snapshot on first sync', async () => {
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
tags:
  - backend
---
Auth block.
`
    );
    await writeProjectFile(
      testRoot,
      'views/api.md',
      `---
id: api-view
---
@stem[block:auth]
`
    );

    const result = await syncProject({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        scannedFiles: 2,
        parsedFiles: 2,
        cachedFiles: 0,
        graphNodes: 2,
        graphEdges: 1
      });
      expect(result.data.durationMs).toBeGreaterThanOrEqual(0);
    }

    const index = await readCacheIndex(testRoot, config);
    expect(index.success).toBe(true);
    if (index.success) {
      expect(Object.keys(index.data.entries).sort()).toEqual(['blocks/auth.md', 'views/api.md']);
      expect(index.data.entries['blocks/auth.md']?.parsed).toMatchObject({ id: 'auth' });
    }

    const snapshot = await readGraphSnapshot(testRoot, config);
    expect(snapshot.success).toBe(true);
    if (snapshot.success) {
      expect(snapshot.data?.nodes.map((node) => node.id).sort()).toEqual(['api-view', 'auth']);
      expect(snapshot.data?.edges).toEqual([
        { type: 'view-uses-block', from: 'api-view', to: 'auth', section: null, tag: null }
      ]);
      expect(snapshot.data?.generatedAt).toEqual(expect.any(String));
    }
  });

  it('reuses cached parsed data when files are unchanged', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');
    await syncProject({ startDir: testRoot });

    const result = await syncProject({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        scannedFiles: 2,
        parsedFiles: 0,
        cachedFiles: 2,
        graphNodes: 2,
        graphEdges: 1
      });
    }
  });

  it('parses changed files and reuses unchanged cached files', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');
    await syncProject({ startDir: testRoot });
    await writeProjectFile(
      testRoot,
      'views/api.md',
      `---
id: api-view
---
@stem[block:auth]
@stem[block:billing]
`
    );

    const result = await syncProject({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        scannedFiles: 2,
        parsedFiles: 1,
        cachedFiles: 1,
        graphNodes: 2,
        graphEdges: 2
      });
    }
  });

  it('removes deleted files from the cache and graph snapshot', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');
    await syncProject({ startDir: testRoot });
    await unlink(path.join(testRoot, 'views/api.md'));

    const result = await syncProject({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        scannedFiles: 1,
        parsedFiles: 0,
        cachedFiles: 1,
        graphNodes: 1,
        graphEdges: 0
      });
    }

    const indexContent = JSON.parse(await readFile(path.join(testRoot, '.stem/cache/index.json'), 'utf8')) as {
      entries: Record<string, unknown>;
    };
    expect(Object.keys(indexContent.entries)).toEqual(['blocks/auth.md']);
  });

  it('serializes block-to-block depends-on edges into the graph snapshot', async () => {
    await writeProjectFile(
      testRoot,
      'blocks/users.md',
      `---
id: users
tags:
  - backend
---
Users block.
`
    );
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
tags:
  - backend
depends-on:
  - users
---
@stem[dep:users]
Auth block that depends on users.
`
    );
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await syncProject({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.graphEdges).toBeGreaterThanOrEqual(2); // view-uses-block + block-depends-on
    }

    const snapshot = await readGraphSnapshot(testRoot, config);
    expect(snapshot.success).toBe(true);
    if (snapshot.success && snapshot.data) {
      // The blockDependsOn map should be serialized correctly
      expect(snapshot.data.blockDependsOn['auth']).toBeDefined();
      const authDep = snapshot.data.blockDependsOn['auth'];
      expect(authDep).toEqual(
        expect.arrayContaining([expect.objectContaining({ blockId: 'users' })])
      );
      // blockDependents is the reverse: users is a dependent of auth
      expect(snapshot.data.blockDependents['users']).toContain('auth');
    }
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

async function createStemProject(projectRoot: string): Promise<void> {
  await mkdir(path.join(projectRoot, '.stem'), { recursive: true });
  await mkdir(path.join(projectRoot, 'blocks'), { recursive: true });
  await mkdir(path.join(projectRoot, 'views'), { recursive: true });
}

async function writeProjectFile(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, ...relativePath.split('/'));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}
