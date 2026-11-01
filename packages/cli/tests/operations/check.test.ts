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
it('uses all configured outputs for reachability and suppresses warnings for incomplete roots', async () => {
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()@stem:block(id:b)B@stem:end()');
  await f.config({
    outputSets: {
      one: { targets: [{ source: { kind: 'block', ref: 'a' }, path: 'a.md' }] },
      two: { targets: [{ source: { kind: 'block', ref: 'b' }, path: 'b.md' }] }
    }
  });
  const check = await cli.checkProject({ startDir: root });
  expect(check).toMatchObject({ success: true, data: { valid: true, warnings: 0 } });
  await f.config({
    outputSets: { one: { targets: [{ source: { kind: 'block', ref: 'missing' }, path: 'a.md' }] } }
  });
  const incomplete = await cli.checkProject({ startDir: root });
  expect(
    incomplete.success && incomplete.data.diagnostics.some((d) => d.code === 'ORPHANED_BLOCK')
  ).toBe(false);
});
it('library projects need no roots; diagnostics remain an evaluated result', async () => {
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()');
  expect(await cli.checkProject({ startDir: root })).toMatchObject({
    success: true,
    data: { valid: true, warnings: 0 }
  });
  await f.put('blocks/b.md', '@stem:include(missing)');
  expect(await cli.checkProject({ startDir: root })).toMatchObject({
    success: true,
    data: { valid: false }
  });
});
