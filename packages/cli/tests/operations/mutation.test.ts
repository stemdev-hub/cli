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
import { vi } from 'vitest';
import * as writer from '../../src/runtime/fs/writer.js';
vi.mock('../../src/runtime/fs/writer.js', async (importOriginal) => {
  const original = await importOriginal<typeof writer>();
  return { ...original, writeFile: vi.fn(original.writeFile) };
});
afterEach(() => vi.restoreAllMocks());
it('retains confirmed source changes when history publication fails', async () => {
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()');
  const original = await vi.importActual<typeof writer>('../../src/runtime/fs/writer.js');
  vi.mocked(writer.writeFile).mockImplementation(async (file, content, options) =>
    file.endsWith('renames.json')
      ? { success: false, error: { code: 'WRITE_FAILED', path: file, message: 'history failed' } }
      : original.writeFile(file, content, options)
  );
  const result = await cli.renameBlock('a', 'b', { startDir: root });
  expect(result).toMatchObject({ success: false, changedFiles: ['blocks/a.md'], stage: 'history' });
  expect(await f.read('blocks/a.md')).toContain('id:b');
});
it('stops remaining writes when a relevant input changes after the first write', async () => {
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()');
  await f.put('blocks/b.md', '@stem:include(a)');
  const original = await vi.importActual<typeof writer>('../../src/runtime/fs/writer.js');
  vi.mocked(writer.writeFile).mockImplementationOnce(async (file, content, options) => {
    const result = await original.writeFile(file, content, options);
    await f.put('blocks/b.md', 'concurrent edit');
    return result;
  });
  const result = await cli.renameBlock('a', 'b', { startDir: root });
  expect(result).toMatchObject({
    success: false,
    changedFiles: ['blocks/a.md'],
    stage: 'revalidation'
  });
  expect(await f.read('blocks/b.md')).toBe('concurrent edit');
});
it('never overwrites a concurrent creator', async () => {
  const original = await vi.importActual<typeof writer>('../../src/runtime/fs/writer.js');
  vi.mocked(writer.writeFile).mockImplementationOnce(async (file, content, options) => {
    await f.put('blocks/new.md', 'concurrent');
    return original.writeFile(file, content, options);
  });
  expect(
    await cli.createBlock('a', {
      startDir: root,
      destination: { kind: 'file', path: 'blocks/new.md' }
    })
  ).toMatchObject({ success: false, changedFiles: [] });
  expect(await f.read('blocks/new.md')).toBe('concurrent');
});
