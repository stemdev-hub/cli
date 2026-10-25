import { randomUUID } from 'node:crypto';
import type * as crypto from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initProject } from '../../src/runtime/operations/init.js';
import { loadStemConfig } from '../../src/runtime/config/index.js';
import * as writer from '../../src/runtime/fs/writer.js';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof crypto>();
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});
vi.mock('../../src/runtime/fs/writer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof writer>();
  return { ...actual, writeFile: vi.fn(actual.writeFile), ensureDir: vi.fn(actual.ensureDir) };
});

const projectId = '0f671f2d-657d-4f3c-9a7d-d22f769c083a';

describe('initProject', () => {
  let testRoot: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-init-'));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('creates the default project scaffold', async () => {
    const result = await initProject({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        projectRoot: testRoot,
        blocksDir: path.join(testRoot, 'blocks'),
        viewsDir: path.join(testRoot, 'views')
      });
    }

    await expect(readJson(path.join(testRoot, '.stem/config.json'))).resolves.toEqual({
      projectId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/) as unknown,
      blocksDir: 'blocks',
      viewsDir: 'views',
      cacheDir: '.stem/cache'
    });
    await expect(readFile(path.join(testRoot, 'blocks/schemas/api.yaml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(path.join(testRoot, 'blocks/schemas/adr.yaml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(path.join(testRoot, '.gitignore'), 'utf8')).resolves.toBe('.stem/cache/\nrendered/\n');
  });

  it('returns a conflict when config already exists without force', async () => {
    await initProject({ startDir: testRoot });

    const result = await initProject({ startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'CONFLICT',
        path: path.join(testRoot, '.stem/config.json')
      }
    });
  });

  it.each([false, true])('preserves existing schema files when force is %s', async (force) => {
    await mkdir(path.join(testRoot, 'blocks/schemas'), { recursive: true });
    await writeFile(path.join(testRoot, 'blocks/schemas/api.yaml'), 'custom api schema\n', 'utf8');
    await writeFile(path.join(testRoot, 'blocks/schemas/adr.yaml'), 'custom adr schema\n', 'utf8');
    if (force) {
      await mkdir(path.join(testRoot, '.stem'), { recursive: true });
      await writeFile(path.join(testRoot, '.stem/config.json'), JSON.stringify({ projectId }), 'utf8');
    }

    const result = await initProject({ startDir: testRoot, force });

    expect(result.success).toBe(true);
    await expect(readFile(path.join(testRoot, 'blocks/schemas/api.yaml'), 'utf8')).resolves.toBe('custom api schema\n');
    await expect(readFile(path.join(testRoot, 'blocks/schemas/adr.yaml'), 'utf8')).resolves.toBe('custom adr schema\n');
    expect(await readJson(path.join(testRoot, '.stem/config.json'))).not.toHaveProperty('schemasDir');
  });

  it('adds the cache entry to an existing gitignore without duplicating it', async () => {
    await writeFile(path.join(testRoot, '.gitignore'), 'node_modules\n', 'utf8');

    await initProject({ startDir: testRoot });
    await initProject({ startDir: testRoot, force: true });

    await expect(readFile(path.join(testRoot, '.gitignore'), 'utf8')).resolves.toBe(
      'node_modules\n.stem/cache/\nrendered/\n'
    );
  });

  it('refuses to initialize inside an existing parent project', async () => {
    await initProject({ startDir: testRoot });
    const nestedDir = path.join(testRoot, 'blocks/nested');
    await mkdir(nestedDir, { recursive: true });

    const result = await initProject({ startDir: nestedDir });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'CONFLICT',
        path: nestedDir
      }
    });
  });
});

describe('identity lifecycle', () => {
  let root: string;
  beforeEach(async () => { vi.resetAllMocks(); root = await mkdtemp(path.join(tmpdir(), 'stem-identity-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('preserves config bytes on repeat and force, honoring configured paths', async () => {
    await mkdir(path.join(root, '.stem'));
    const configPath = path.join(root, '.stem/config.json');
    const content = JSON.stringify({ projectId, blocksDir: 'custom/blocks', viewsDir: 'custom/views',
      cacheDir: '.stem/state', namespace: 'docs', namespaces: { shared: { localPath: '../shared' } } }, null, 4) + '\n';
    await writeFile(configPath, content);
    expect(await initProject({ startDir: root })).toMatchObject({ success: false, error: { code: 'CONFLICT' } });
    expect(await readdir(root)).toEqual(['.stem']);
    expect(await initProject({ startDir: root, force: true })).toMatchObject({ success: true, data: {
      blocksDir: path.join(root, 'custom/blocks'), viewsDir: path.join(root, 'custom/views')
    } });
    expect(await readFile(configPath, 'utf8')).toBe(content);
    expect(await readFile(path.join(root, '.gitignore'), 'utf8')).toBe('.stem/state/\nrendered/\n');
    vi.mocked(randomUUID).mockClear();
    expect((await initProject({ startDir: root, force: true })).success).toBe(true);
    expect(randomUUID).not.toHaveBeenCalled();
    expect(await readFile(configPath, 'utf8')).toBe(content);
  });

  it.each([false, true])('rejects existing invalid config before writes (force=%s)', async (force) => {
    await mkdir(path.join(root, '.stem'));
    const configPath = path.join(root, '.stem/config.json');
    for (const content of ['{}', '{"projectId":"bad"}', '{ broken', '[]',
      JSON.stringify({ projectId, version: '1' }), JSON.stringify({ projectId, schemasDir: 'schemas' })]) {
      await writeFile(configPath, content);
      expect(await initProject({ startDir: root, force })).toMatchObject({ success: false, error: { code: 'CONFIG_ERROR' } });
      expect(await readFile(configPath, 'utf8')).toBe(content);
    }
    expect(await readdir(root)).toEqual(['.stem']);
    expect(writer.writeFile).not.toHaveBeenCalled();
    expect(writer.ensureDir).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('rejects unreadable configuration before creating scaffolding', async () => {
    await mkdir(path.join(root, '.stem/config.json'), { recursive: true });
    expect(await initProject({ startDir: root, force: true })).toMatchObject({ success: false,
      error: { code: 'CONFIG_ERROR', cause: { code: 'CONFIG_READ_FAILED' } } });
    expect(writer.writeFile).not.toHaveBeenCalled();
    expect(writer.ensureDir).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('creates distinct identities and preserves one across a move and additional checkout', async () => {
    const original = path.join(root, 'original');
    const independent = path.join(root, 'independent');
    const moved = path.join(root, 'renamed');
    const checkout = path.join(root, 'checkout');
    await mkdir(original);
    await mkdir(independent);
    expect((await initProject({ startDir: original })).success).toBe(true);
    expect((await initProject({ startDir: independent, force: true })).success).toBe(true);
    const content = await readFile(path.join(original, '.stem/config.json'), 'utf8');
    const first = await loadStemConfig(original);
    const second = await loadStemConfig(independent);
    if (!first.success || !second.success) throw new Error('Expected valid project configurations');
    expect(first.data.projectId).not.toBe(second.data.projectId);
    await rename(original, moved);
    await cp(moved, checkout, { recursive: true });
    for (const projectRoot of [moved, checkout]) {
      expect((await loadStemConfig(projectRoot)).success).toBe(true);
      expect((await initProject({ startDir: projectRoot, force: true })).success).toBe(true);
      expect(await readFile(path.join(projectRoot, '.stem/config.json'), 'utf8')).toBe(content);
    }
    await writeFile(path.join(checkout, '.stem/config.json'), JSON.stringify({ projectId }));
    expect(await loadStemConfig(checkout)).toMatchObject({ success: true, data: { projectId } });
    expect(await readFile(path.join(moved, '.stem/config.json'), 'utf8')).toBe(content);
  });

  it.each([false, true])('preserves a concurrent creator even with force=%s', async (force) => {
    const actual = await vi.importActual<typeof writer>('../../src/runtime/fs/writer.js');
    const content = JSON.stringify({ projectId });
    vi.mocked(writer.writeFile).mockImplementationOnce(async (file, candidate, options) => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
      return actual.writeFile(file, candidate, options);
    });
    expect(await initProject({ startDir: root, force })).toMatchObject({ success: false, error: { code: 'CONFLICT' } });
    expect(await readFile(path.join(root, '.stem/config.json'), 'utf8')).toBe(content);
    expect(await readdir(path.join(root, '.stem'))).toEqual(['config.json']);
    expect(writer.ensureDir).not.toHaveBeenCalled();
  });

  it('reports generation failure without writes', async () => {
    vi.mocked(randomUUID).mockImplementationOnce(() => { throw new Error('entropy unavailable'); });
    expect(await initProject({ startDir: root })).toMatchObject({ success: false, error: { code: 'FS_ERROR' } });
    expect(await readdir(root)).toEqual([]);
    expect(writer.writeFile).not.toHaveBeenCalled();
  });

  it('reports failed configuration publication and establishes no identity', async () => {
    vi.mocked(writer.writeFile).mockResolvedValueOnce({ success: false, error: {
      code: 'WRITE_FAILED', message: 'failed publication', path: path.join(root, '.stem/config.json')
    } });
    expect(await initProject({ startDir: root })).toMatchObject({ success: false, error: { code: 'FS_ERROR' } });
    expect(await loadStemConfig(root)).toMatchObject({ success: false, error: { code: 'CONFIG_NOT_FOUND' } });
    expect(writer.ensureDir).not.toHaveBeenCalled();
  });

  it('preserves established identity when scaffolding fails and is retried', async () => {
    vi.mocked(writer.ensureDir).mockResolvedValueOnce({ success: false, error: {
      code: 'WRITE_FAILED', message: 'failed scaffold', path: root
    } });
    expect(await initProject({ startDir: root })).toMatchObject({ success: false, error: { code: 'FS_ERROR' } });
    const configPath = path.join(root, '.stem/config.json');
    const content = await readFile(configPath, 'utf8');
    expect((await loadStemConfig(root)).success).toBe(true);
    expect((await initProject({ startDir: root, force: true })).success).toBe(true);
    expect(await readFile(configPath, 'utf8')).toBe(content);
  });
});

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}
