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
it('publishes eligible targets even when another is ineligible and retains scoped diagnostics', async () => {
  await f.put(
    'blocks/a.md',
    '@stem:block(id:a)exact@stem:end()@stem:block(id:bad)pre@stem:include(missing)post@stem:end()'
  );
  await f.config({
    outputSets: {
      docs: {
        outputDir: 'out',
        targets: [
          { source: { kind: 'block', ref: 'a' }, path: 'a.md' },
          { source: { kind: 'block', ref: 'bad' }, path: 'bad.md' }
        ]
      }
    }
  });
  const result = await cli.renderOutputs({ kind: 'all' }, { startDir: root });
  expect(result.success).toBe(false);
  expect(result.targets).toEqual([
    expect.objectContaining({ status: 'published', tracking: 'persisted', diagnostics: [] }),
    expect.objectContaining({
      status: 'not-published',
      reason: 'Composition is incomplete or has blocking diagnostics.'
    })
  ]);
  expect(await f.read('out/a.md')).toBe('exact');
  await expect(f.read('out/bad.md')).rejects.toMatchObject({ code: 'ENOENT' });
});
it('rejects whole-plan physical collisions and source destinations before writes', async () => {
  await f.put('blocks/a.md', 'A');
  await f.config({
    outputSets: {
      one: {
        outputDir: 'out',
        targets: [{ source: { kind: 'file', path: 'blocks/a.md' }, path: 'same.md' }]
      },
      two: {
        outputDir: './out',
        targets: [{ source: { kind: 'file', path: 'blocks/a.md' }, path: 'same.md' }]
      }
    }
  });
  expect((await cli.renderOutputs({ kind: 'all' }, { startDir: root })).success).toBe(false);
  await expect(f.read('out/same.md')).rejects.toMatchObject({ code: 'ENOENT' });
  await f.config({
    outputSets: {
      bad: { targets: [{ source: { kind: 'file', path: 'blocks/a.md' }, path: 'blocks/a.md' }] }
    }
  });
  expect((await cli.renderOutputs({ kind: 'all' }, { startDir: root })).success).toBe(false);
  expect(await f.read('blocks/a.md')).toBe('A');
});
it('skips intentionally and rejects invalid selections; library all is a no-op', async () => {
  expect(await cli.renderOutputs({ kind: 'all' }, { startDir: root })).toEqual({
    success: true,
    targets: [],
    cleanup: [],
    errors: []
  });
  expect(
    (await cli.renderOutputs({ kind: 'sets', sets: [{ name: 'missing' }] }, { startDir: root }))
      .success
  ).toBe(false);
  await f.put('blocks/a.md', 'new');
  await f.put('out/a.md', 'old');
  await f.config({
    outputSets: {
      docs: {
        outputDir: 'out',
        ifExists: 'skip',
        targets: [{ source: { kind: 'file', path: 'blocks/a.md' }, path: 'a.md' }]
      }
    }
  });
  expect(await cli.renderOutputs({ kind: 'all' }, { startDir: root })).toMatchObject({
    success: true,
    targets: [{ status: 'skipped', tracking: 'unchanged' }]
  });
  expect(await f.read('out/a.md')).toBe('old');
});
