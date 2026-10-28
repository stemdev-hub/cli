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
it('inserts repeated and file-level inclusions without expanding them', async () => {
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()');
  await f.put('blocks/b.md', 'prefix');
  for (let n = 0; n < 2; n++)
    expect(
      (
        await cli.addInclusion('a', {
          startDir: root,
          destination: { kind: 'file', path: 'blocks/b.md' }
        })
      ).success
    ).toBe(true);
  expect(await f.read('blocks/b.md')).toBe('prefix\n@stem:include(a)\n@stem:include(a)\n');
  expect(await cli.listReferences('a', { startDir: root })).toMatchObject({
    success: true,
    data: { total: 2, complete: true }
  });
});
it('rejects missing and ambiguous targets before writes', async () => {
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()@stem:block(id:a)B@stem:end()');
  const before = await f.read('blocks/a.md');
  for (const ref of ['a', 'missing', 'bad.ref'])
    expect(
      (
        await cli.addInclusion(ref, {
          startDir: root,
          destination: { kind: 'file', path: 'blocks/a.md' }
        })
      ).success
    ).toBe(false);
  expect(await f.read('blocks/a.md')).toBe(before);
});
