import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { initProject, loadStemConfig } from '../../src/index.js';
let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'stem-cache-'));
  expect((await initProject({ startDir: root })).success).toBe(true);
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

import { writeGraphSnapshot, GRAPH_SNAPSHOT_VERSION } from '../../src/runtime/cache/graph-store.js';
it('replaces corrupt disposable data with the supplied projection', async () => {
  const config = await loadStemConfig(root);
  if (!config.success) throw new Error('config');
  const file = path.join(root, config.data.cacheDir, 'graph.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, 'corrupt');
  const data = {
    version: GRAPH_SNAPSHOT_VERSION,
    generatedAt: '2026-10-28T00:00:00Z',
    nodes: [{ source: 'blocks/doc.md', id: 'doc', tags: ['guide'] }],
    edges: []
  };
  expect(await writeGraphSnapshot(root, config.data, data)).toEqual({
    success: true,
    data: undefined
  });
  expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual(data);
});
it('reports failed publication without replacing a directory', async () => {
  const config = await loadStemConfig(root);
  if (!config.success) throw new Error('config');
  const file = path.join(root, config.data.cacheDir, 'graph.json');
  await fs.mkdir(file, { recursive: true });
  const result = await writeGraphSnapshot(root, config.data, {
    version: GRAPH_SNAPSHOT_VERSION,
    generatedAt: '2026-10-28T00:00:00Z',
    nodes: [{ source: 'blocks/doc.md', id: 'doc', tags: ['guide'] }],
    edges: []
  });
  expect(result).toMatchObject({ success: false, error: { code: 'CACHE_WRITE_FAILED' } });
  expect((await fs.stat(file)).isDirectory()).toBe(true);
});
