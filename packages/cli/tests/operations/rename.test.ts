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
it('renames tokens, local output selectors and history while preserving filenames', async () => {
  await f.put(
    'blocks/a.md',
    'old prose@stem:block(id:old)@stem:block(id:child)C@stem:end(id:child)@stem:end(id:old)@stem:include(old)'
  );
  await f.config({
    outputSets: { docs: { targets: [{ source: { kind: 'block', ref: 'old' }, path: 'old.md' }] } }
  });
  expect(await cli.renameBlock('old', 'new', { startDir: root })).toMatchObject({
    success: true,
    changedFiles: ['blocks/a.md', '.stem/config.json', '.stem/renames.json'],
    affectedReferences: 2
  });
  expect(await f.read('blocks/a.md')).toContain('old prose@stem:block(id:new)');
  expect(await f.read('blocks/a.md')).toContain('id:child');
  expect(await f.read('.stem/config.json')).toContain('"ref": "new"');
  expect(await f.read('.stem/config.json')).toContain('old.md');
  expect(JSON.parse(await f.read('.stem/renames.json'))).toEqual([
    expect.objectContaining({ from: 'old', to: 'new' })
  ]);
});
it('rejects corrupt history before any source write', async () => {
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()');
  await f.put('.stem/renames.json', '{bad');
  const before = await f.read('blocks/a.md');
  expect((await cli.renameBlock('a', 'b', { startDir: root })).success).toBe(false);
  expect(await f.read('blocks/a.md')).toBe(before);
});
