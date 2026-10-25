import { link, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertNoOutputCollisions, inspectBookkeepingPath, inspectOutputPaths, isCanonicalOutputPath,
  resolveOutputRoot, revalidateOutputRoot } from '../../src/runtime/output/paths.js';

describe('output paths', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'stem-output-paths-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('resolves relative and external roots from the project, with no read-time writes', async () => {
    const project = path.join(dir, 'project');
    await mkdir(project);
    const root = await resolveOutputRoot(project, '../new/output', []);
    expect(root.path).toBe(path.join(dir, 'new/output'));
    expect(await inspectOutputPaths(root, ['docs/start.md'])).toEqual([{ path: path.join(dir, 'new/output/docs/start.md'), identity: undefined }]);
    expect(await readdir(dir)).toEqual(['project']);
    expect((await resolveOutputRoot(project, '.', [])).path).toBe(project);
    expect((await resolveOutputRoot(project, root.path, [])).path).toBe(root.path);
  });

  it.each(['', 'C:relative', 'https://example.com/out', 'file:///tmp/out', '\0'])('rejects ambiguous root %j', async value => {
    await expect(resolveOutputRoot(dir, value, [])).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });

  it.each(['', '.', '..', '../a', 'a/../b', 'a//b', 'a/', './a', '/abs', 'C:/abs', 'C:rel', 'a\\b', 'a\0b'])('rejects noncanonical file %j', value => {
    expect(isCanonicalOutputPath(value)).toBe(false);
  });

  it('requires explicit absolute project and protection contexts', async () => {
    await expect(resolveOutputRoot('relative', '.', [])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    await expect(resolveOutputRoot(dir, '.', ['relative'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });

  it('protects supplied source/cache/connected paths and automatic Git/internal state', async () => {
    const root = await resolveOutputRoot(dir, '.', [path.join(dir, 'blocks'), path.join(dir, 'cache'), path.join(dir, 'connected')]);
    for (const target of ['blocks/a.md', 'cache/a', 'connected/a.md', '.git/HEAD', '.stem/config.json', '.stem/outputs.json', '.stem/outputs.lock']) {
      await expect(inspectOutputPaths(root, [target])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    }
    expect(await inspectBookkeepingPath(root, 'outputs.json')).toBe(path.join(dir, '.stem/outputs.json'));
    expect(await readdir(dir)).toEqual([]);
  });

  it('rejects bookkeeping roots placed inside protected source directories', async () => {
    const root = await resolveOutputRoot(dir, 'blocks/output', [path.join(dir, 'blocks')]);
    await expect(inspectBookkeepingPath(root, 'outputs.lock')).rejects.toMatchObject({ code: 'INVALID_PATH' });
    expect(await readdir(dir)).toEqual([]);
  });

  it.each([['a.md', 'a.md'], ['a.md', 'A.md'], ['guide', 'guide/start.md']])('rejects lexical destination collisions %j', async (...files) => {
    await expect(inspectOutputPaths(await resolveOutputRoot(dir, '.', []), files)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('resolves directory aliases and rejects escape, alias and hard-link collisions', async () => {
    const output = path.join(dir, 'out');
    const outside = path.join(dir, 'outside');
    await mkdir(output); await mkdir(outside); await mkdir(path.join(output, 'nested'));
    await symlink(path.join(output, 'nested'), path.join(output, 'alias'), 'junction');
    await symlink(outside, path.join(output, 'escape'), 'junction');
    await symlink(output, path.join(dir, 'root-alias'), 'junction');
    const root = await resolveOutputRoot(dir, 'out', []);
    expect((await resolveOutputRoot(dir, 'root-alias', [])).path).toBe(root.path);
    await expect(inspectOutputPaths(root, ['escape/new/file.md'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    await expect(inspectOutputPaths(root, ['nested/new.md', 'alias/new.md'])).rejects.toMatchObject({ code: 'CONFLICT' });
    await writeFile(path.join(output, 'a'), 'same');
    await link(path.join(output, 'a'), path.join(output, 'b'));
    await expect(inspectOutputPaths(root, ['a', 'b'])).rejects.toMatchObject({ code: 'CONFLICT' });
    const first = await inspectOutputPaths(root, ['a']);
    const aliasRoot = await resolveOutputRoot(dir, 'root-alias', []);
    const second = await inspectOutputPaths(aliasRoot, ['a']);
    expect(() => assertNoOutputCollisions([...first, ...second])).toThrow('collide');
  });

  it('protects aliases to source directories and hard links to protected files', async () => {
    await mkdir(path.join(dir, 'blocks'));
    await symlink(path.join(dir, 'blocks'), path.join(dir, 'alias'), 'junction');
    await mkdir(path.join(dir, '.stem'));
    await writeFile(path.join(dir, '.stem/config.json'), 'config');
    await link(path.join(dir, '.stem/config.json'), path.join(dir, 'innocent.md'));
    const root = await resolveOutputRoot(dir, '.', [path.join(dir, 'blocks')]);
    await expect(inspectOutputPaths(root, ['alias/new.md'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    await expect(inspectOutputPaths(root, ['innocent.md'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    expect(await readFile(path.join(dir, '.stem/config.json'), 'utf8')).toBe('config');
  });

  it('rejects directories, dangling directory links and retargeted roots', async () => {
    await mkdir(path.join(dir, 'a')); await mkdir(path.join(dir, 'b'));
    await symlink(path.join(dir, 'a'), path.join(dir, 'alias'), 'junction');
    const root = await resolveOutputRoot(dir, 'alias', []);
    await rm(path.join(dir, 'alias'));
    await symlink(path.join(dir, 'b'), path.join(dir, 'alias'), 'junction');
    await expect(revalidateOutputRoot(root)).rejects.toMatchObject({ code: 'INVALID_PATH' });
    await expect(inspectOutputPaths(await resolveOutputRoot(dir, '.', []), ['a'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    await symlink(path.join(dir, 'missing'), path.join(dir, 'dangling'), 'junction');
    await expect(resolveOutputRoot(dir, 'dangling/child', [])).rejects.toMatchObject({ code: 'IO_ERROR' });
  });

  it('rejects file symlinks without modifying the referenced file', async context => {
    await writeFile(path.join(dir, 'source'), 'preserved');
    try { await symlink(path.join(dir, 'source'), path.join(dir, 'alias-file'), 'file'); }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EPERM') { context.skip(); return; }
      throw error;
    }
    await expect(inspectOutputPaths(await resolveOutputRoot(dir, '.', []), ['alias-file'])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    expect(await readFile(path.join(dir, 'source'), 'utf8')).toBe('preserved');
  });

  it.skipIf(process.platform !== 'win32')('rejects Windows aliases and drive-root-relative paths', async () => {
    const root = await resolveOutputRoot(dir, '.', []);
    for (const target of ['a.md.', 'a.md ', 'NUL.md', 'COM¹.txt', 'file:stream', 'a?b']) {
      await expect(inspectOutputPaths(root, [target])).rejects.toMatchObject({ code: 'INVALID_PATH' });
    }
    await expect(resolveOutputRoot(dir, '/root-relative', [])).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });
});
