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
it('returns exact scoped content despite unrelated project errors and never writes', async () => {
  await f.put(
    'blocks/a.md',
    '@stem:block(id:a)  A\r\nB  @stem:end()@stem:block(id:bad)@stem:include(missing)@stem:end()'
  );
  const before = await fs.readdir(path.join(root, '.stem'));
  const config = await f.read('.stem/config.json');
  expect(await cli.previewSource({ kind: 'block', ref: 'a' }, { startDir: root })).toEqual({
    success: true,
    data: { content: '  A\r\nB  ', complete: true, diagnostics: [] }
  });
  expect(await fs.readdir(path.join(root, '.stem'))).toEqual(before);
  expect(await f.read('.stem/config.json')).toBe(config);
});
it('retains partial preview and rejects external metadata as source', async () => {
  await f.put('blocks/a.md', 'pre@stem:include(lib:x)post');
  await f.config({ namespaces: { lib: { graphUrl: 'https://example.test/meta' } } });
  const result = await cli.previewSource({ kind: 'file', path: 'blocks/a.md' }, { startDir: root });
  expect(result).toMatchObject({ success: true, data: { content: 'prepost', complete: false } });
});
it('accepts zero budget and rejects paths outside source', async () => {
  await f.put('blocks/a.md', 'hello');
  expect(
    await cli.previewSource(
      { kind: 'file', path: 'blocks/a.md' },
      { startDir: root, limits: { maxWork: 0, maxOutputBytes: 0 } }
    )
  ).toMatchObject({ success: true, data: { content: '', complete: false } });
  expect(
    await cli.previewSource({ kind: 'file', path: '../a.md' }, { startDir: root })
  ).toMatchObject({ success: false });
});
