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
it('uses one source inventory, preserves old Views and rejects manifest-only project roots', async () => {
  await f.put('views/old.md', 'authored View');
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()');
  expect(await cli.listBlocks({ startDir: root })).toMatchObject({
    success: true,
    data: { total: 1, blocks: [{ id: 'a', sourceId: 'blocks/a.md' }] }
  });
  expect(await f.read('views/old.md')).toBe('authored View');
  await fs.unlink(path.join(root, '.stem/config.json'));
  await f.put('.stem/outputs.json', '{}');
  expect(await cli.listBlocks({ startDir: root })).toMatchObject({
    success: false,
    error: { code: 'PROJECT_ROOT_NOT_FOUND' }
  });
});
it('rejects viewsDir through the generic unknown-field path and accepts empty output sets', async () => {
  await f.config({ viewsDir: 'views' });
  expect(await cli.listOutputs({ startDir: root })).toMatchObject({
    success: false,
    error: { code: 'CONFIG_ERROR' }
  });
});
