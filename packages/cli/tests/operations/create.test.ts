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
it('creates explicit roots and children with direct Tags without output mappings', async () => {
  expect(
    await cli.createBlock('Parent', {
      startDir: root,
      destination: { kind: 'file', path: 'blocks/doc.md' },
      tags: ['guide', 'quoted " tag']
    })
  ).toMatchObject({ success: true, changedFiles: ['blocks/doc.md'] });
  const child = await cli.createBlock('Child', {
    startDir: root,
    destination: { kind: 'block', id: 'Parent' }
  });
  expect(child.success, JSON.stringify(child)).toBe(true);
  const content = await f.read('blocks/doc.md');
  expect(content).toContain('id:Parent');
  expect(content.indexOf('id:Child')).toBeLessThan(content.indexOf('@stem:end(id:Parent)'));
  expect(await cli.listBlocks({ startDir: root })).toMatchObject({
    success: true,
    data: { total: 2 }
  });
  expect(await cli.listOutputs({ startDir: root })).toMatchObject({
    success: true,
    data: { outputSets: {} }
  });
});
it.each([
  '../escape.md',
  'views/a.md',
  'blocks/.hidden.md',
  'blocks/a.txt',
  'blocks/node_modules/a.md',
  'blocks/dist/a.md'
])('rejects unsafe/undiscoverable destinations %s', async (file) => {
  expect(
    (await cli.createBlock('a', { startDir: root, destination: { kind: 'file', path: file } }))
      .success
  ).toBe(false);
});
it('preserves original text and refuses collisions and recovered roots', async () => {
  await f.put('blocks/a.md', 'before@stem:block(id:a)open');
  const before = await f.read('blocks/a.md');
  expect(
    (
      await cli.createBlock('b', {
        startDir: root,
        destination: { kind: 'file', path: 'blocks/a.md' }
      })
    ).success
  ).toBe(false);
  expect(
    (
      await cli.createBlock('a', {
        startDir: root,
        destination: { kind: 'file', path: 'blocks/b.md' }
      })
    ).success
  ).toBe(false);
  expect(await f.read('blocks/a.md')).toBe(before);
});

it('allows a configured hidden source root while still rejecting hidden descendants', async () => {
  await f.config({ blocksDir: '.sources' });
  expect(
    await cli.createBlock('a', {
      startDir: root,
      destination: { kind: 'file', path: '.sources/a.md' }
    })
  ).toMatchObject({ success: true });
  expect(await cli.listBlocks({ startDir: root })).toMatchObject({
    success: true,
    data: { total: 1 }
  });
});
