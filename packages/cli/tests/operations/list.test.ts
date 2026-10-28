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
it('lists nested duplicate and unusable IDs as distinct located rows', async () => {
  await f.put('blocks/b.md', '@stem:block(id:a)B@stem:end()');
  await f.put(
    'blocks/a.md',
    '@stem:block(id:a tags:[guide])@stem:block(tags:[guide])C@stem:end()@stem:end()'
  );
  const result = await cli.listBlocks({ startDir: root });
  expect(result).toMatchObject({
    success: true,
    data: {
      total: 3,
      blocks: [
        { id: 'a', sourceId: 'blocks/a.md' },
        { sourceId: 'blocks/a.md' },
        { id: 'a', sourceId: 'blocks/b.md' }
      ]
    }
  });
  if (result.success) expect(result.data.blocks[1]).not.toHaveProperty('id');
  expect((await cli.listReferences('a', { startDir: root })).success).toBe(false);
});
it('retains known Tag matches with incomplete classification and reference completeness', async () => {
  await f.put(
    'blocks/a.md',
    '@stem:block(id:a tags:[guide])A@stem:end()@stem:block(id:b tags:[broken)B@stem:end()@stem:include(missing)'
  );
  const result = await cli.listBlocks({ startDir: root, tag: 'guide' });
  expect(result).toMatchObject({
    success: true,
    data: { total: 1, classificationComplete: false }
  });
  expect(await cli.listReferences('a', { startDir: root })).toMatchObject({
    success: true,
    data: { total: 0, complete: false }
  });
});
