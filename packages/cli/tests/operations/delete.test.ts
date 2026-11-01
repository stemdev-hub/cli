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
it('preserves the source file and surrounding text; checks descendant output references', async () => {
  await f.put(
    'blocks/a.md',
    'before@stem:block(id:p)@stem:block(id:c)C@stem:end()@stem:end()after'
  );
  await f.config({
    outputSets: { docs: { targets: [{ source: { kind: 'block', ref: 'c' }, path: 'c.md' }] } }
  });
  expect((await cli.deleteBlock('p', { startDir: root })).success).toBe(false);
  expect(await cli.deleteBlock('p', { startDir: root, force: true })).toMatchObject({
    success: true,
    affectedReferences: 1
  });
  expect(await f.read('blocks/a.md')).toBe('beforeafter');
});
it('force cannot bypass incomplete reference assessment', async () => {
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()@stem:include(missing)');
  expect((await cli.deleteBlock('a', { startDir: root, force: true })).success).toBe(false);
});
