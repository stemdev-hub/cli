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
import { findBlockFiles, findProjectRoot } from '../../src/runtime/fs/finder.js';
it('discovers only configured Markdown sources and ignores hidden/tool directories', async () => {
  for (const file of [
    'blocks/a.md',
    'blocks/nested/b.md',
    'blocks/.hidden/c.md',
    'blocks/node_modules/d.md',
    'views/e.md',
    'blocks/f.yaml'
  ])
    await f.put(file, '');
  const config = await cli.loadStemConfig(root);
  if (!config.success) throw new Error('config');
  const result = await findBlockFiles(root, config.data);
  expect(
    result.success && result.data.map((file) => path.relative(root, file).replaceAll('\\', '/'))
  ).toEqual(['blocks/a.md', 'blocks/nested/b.md']);
});
it('a manifest-only directory is not a source root', async () => {
  await fs.unlink(path.join(root, '.stem/config.json'));
  await f.put('.stem/outputs.json', '{}');
  expect(await findProjectRoot(root)).toMatchObject({
    success: false,
    error: { code: 'NO_PROJECT_ROOT' }
  });
});
it('rejects a source-directory junction escaping the project', async () => {
  const outside = await fs.mkdtemp(path.join(tmpdir(), 'stem-outside-'));
  try {
    await fs.rmdir(path.join(root, 'blocks'));
    await fs.symlink(outside, path.join(root, 'blocks'), 'junction');
    await fs.writeFile(path.join(outside, 'a.md'), 'outside');
    const result = await cli.listBlocks({ startDir: root });
    expect(result.success).toBe(false);
  } finally {
    await fs.unlink(path.join(root, 'blocks'));
    await fs.rm(outside, { recursive: true, force: true });
  }
});
