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
it('assesses without writing then removes only unchanged owned obsolete outputs', async () => {
  await f.put('blocks/a.md', 'A');
  await f.config({
    outputSets: {
      docs: {
        outputDir: 'out',
        targets: [{ source: { kind: 'file', path: 'blocks/a.md' }, path: 'a.md' }]
      }
    }
  });
  expect((await cli.renderOutputs({ kind: 'all' }, { startDir: root })).success).toBe(true);
  await f.config({ outputSets: {} });
  const manifest = await f.read('out/.stem/outputs.json');
  const assessed = await cli.cleanupOutputs({ startDir: root, outputDir: 'out', set: 'docs' });
  expect(assessed.success).toBe(true);
  expect(await f.read('out/a.md')).toBe('A');
  expect(await f.read('out/.stem/outputs.json')).toBe(manifest);
  expect(
    (await cli.cleanupOutputs({ startDir: root, outputDir: 'out', set: 'docs', apply: true }))
      .success
  ).toBe(true);
  await expect(f.read('out/a.md')).rejects.toMatchObject({ code: 'ENOENT' });
});
it('protects current mappings in other sets, including during retired-set cleanup', async () => {
  await f.put('blocks/a.md', 'A');
  await f.config({
    outputSets: {
      old: {
        outputDir: 'out',
        targets: [{ source: { kind: 'file', path: 'blocks/a.md' }, path: 'a.md' }]
      }
    }
  });
  await cli.renderOutputs({ kind: 'all' }, { startDir: root });
  await f.config({
    outputSets: {
      current: {
        outputDir: 'out',
        targets: [{ source: { kind: 'file', path: 'blocks/a.md' }, path: 'a.md' }]
      }
    }
  });
  await cli.cleanupOutputs({ startDir: root, outputDir: 'out', set: 'old', apply: true });
  expect(await f.read('out/a.md')).toBe('A');
});
