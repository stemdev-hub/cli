import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initProject } from '../../src/core/operations/init.js';

describe('initProject', () => {
  let testRoot: string;

  beforeEach(async () => {
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
        viewsDir: path.join(testRoot, 'views'),
        schemasDir: path.join(testRoot, 'blocks/schemas')
      });
    }

    await expect(readJson(path.join(testRoot, '.stem/config.json'))).resolves.toEqual({
      version: '1',
      blocksDir: 'blocks',
      viewsDir: 'views',
      schemasDir: 'blocks/schemas',
      cacheDir: '.stem/cache'
    });
    await expect(readFile(path.join(testRoot, 'blocks/schemas/api.yaml'), 'utf8')).resolves.toContain('name: api');
    await expect(readFile(path.join(testRoot, 'blocks/schemas/adr.yaml'), 'utf8')).resolves.toContain('name: adr');
    await expect(readFile(path.join(testRoot, '.gitignore'), 'utf8')).resolves.toBe('.stem/cache/\n');
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

  it('overwrites scaffold files when force is true', async () => {
    await initProject({ startDir: testRoot });
    await writeFile(path.join(testRoot, 'blocks/schemas/api.yaml'), 'custom api schema\n', 'utf8');

    const result = await initProject({ startDir: testRoot, force: true });

    expect(result.success).toBe(true);
    await expect(readFile(path.join(testRoot, 'blocks/schemas/api.yaml'), 'utf8')).resolves.toContain(
      'endpoint'
    );
  });

  it('adds the cache entry to an existing gitignore without duplicating it', async () => {
    await writeFile(path.join(testRoot, '.gitignore'), 'node_modules\n', 'utf8');

    await initProject({ startDir: testRoot });
    await initProject({ startDir: testRoot, force: true });

    await expect(readFile(path.join(testRoot, '.gitignore'), 'utf8')).resolves.toBe(
      'node_modules\n.stem/cache/\n'
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

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}
