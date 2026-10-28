import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, expect, it } from 'vitest';
import * as cli from '../../src/index.js';
let root: string;
const f = {
  put: async (relative: string, text: string) => {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  },
  read: (relative: string) => fs.readFile(path.join(root, relative), 'utf8'),
  config: async (extra: object) => {
    const original = JSON.parse(await f.read('.stem/config.json')) as object;
    await f.put('.stem/config.json', JSON.stringify({ ...original, ...extra }));
  }
};
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'stem-integration-'));
  expect((await cli.initProject({ startDir: root })).success).toBe(true);
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
it('freshly parses every source and persists only position-free projections', async () => {
  await f.put(
    'blocks/a.md',
    '@stem:block(id:a)A@stem:block(id:b)B@stem:end()@stem:include(b)@stem:end()'
  );
  await f.put('.stem/cache/index.json', 'corrupt');
  for (let i = 0; i < 2; i++) {
    const result = await cli.syncProject({ startDir: root });
    expect(result).toMatchObject({
      success: true,
      data: { scannedFiles: 1, parsedFiles: 1, graphNodes: 2, graphEdges: 2 }
    });
    if (result.success) expect(result.data).not.toHaveProperty('cachedFiles');
  }
  const graph = JSON.parse(await f.read('.stem/cache/graph.json')) as Record<string, unknown>;
  expect(graph['nodes']).toHaveLength(2);
  const text = await f.read('.stem/cache/graph.json');
  for (const forbidden of ['startOffset', 'endOffset', 'syntax', 'content', 'handle'])
    expect(text).not.toContain('"' + forbidden + '"');
  expect(await f.read('.stem/cache/index.json')).not.toContain('"parsed"');
});
