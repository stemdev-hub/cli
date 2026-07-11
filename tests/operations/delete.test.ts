import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteBlock, deleteView } from '../../src/core/operations/delete.js';

describe('delete operations', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-delete-'));
    await createStemProject(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('deletes an unreferenced block', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');

    const result = await deleteBlock('auth', { startDir: testRoot });

    expect(result).toEqual({
      success: true,
      data: {
        id: 'auth',
        filePath: path.join(testRoot, 'blocks/auth.md'),
        relativePath: 'blocks/auth.md',
        referencingIds: [],
        forced: false
      }
    });
    await expectPathMissing(path.join(testRoot, 'blocks/auth.md'));
  });

  it('refuses to delete a referenced block without force', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'blocks/api.md', '---\nid: api\ndepends-on:\n  - auth\n---\nAPI block.\n');
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await deleteBlock('auth', { startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'CONFLICT',
        path: path.join(testRoot, 'blocks/auth.md')
      }
    });
    await expect(readFile(path.join(testRoot, 'blocks/auth.md'), 'utf8')).resolves.toContain('Auth block');
  });

  it('deletes a referenced block when force is true and reports referencing IDs', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'blocks/api.md', '---\nid: api\ndepends-on:\n  - auth\n---\nAPI block.\n');
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await deleteBlock('auth', { startDir: testRoot, force: true });

    expect(result).toEqual({
      success: true,
      data: {
        id: 'auth',
        filePath: path.join(testRoot, 'blocks/auth.md'),
        relativePath: 'blocks/auth.md',
        referencingIds: ['api', 'api-view'],
        forced: true
      }
    });
    await expectPathMissing(path.join(testRoot, 'blocks/auth.md'));
  });

  it('deletes a view by ID', async () => {
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\nView.\n');

    const result = await deleteView('api-view', { startDir: testRoot });

    expect(result).toEqual({
      success: true,
      data: {
        id: 'api-view',
        filePath: path.join(testRoot, 'views/api.md'),
        relativePath: 'views/api.md',
        referencingIds: [],
        forced: false
      }
    });
    await expectPathMissing(path.join(testRoot, 'views/api.md'));
  });

  it('returns an operation error for missing IDs', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\nView.\n');

    await expect(deleteBlock('missing', { startDir: testRoot })).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
    await expect(deleteView('missing-view', { startDir: testRoot })).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
  });

  it('returns an operation error when no project root exists', async () => {
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'stem-delete-outside-'));

    try {
      const result = await deleteBlock('auth', { startDir: outsideRoot });

      expect(result).toMatchObject({
        success: false,
        error: { code: 'PROJECT_ROOT_NOT_FOUND' }
      });
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });
});

async function createStemProject(projectRoot: string): Promise<void> {
  await mkdir(path.join(projectRoot, '.stem'), { recursive: true });
  await mkdir(path.join(projectRoot, 'blocks'), { recursive: true });
  await mkdir(path.join(projectRoot, 'views'), { recursive: true });
}

async function writeProjectFile(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, ...relativePath.split('/'));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function expectPathMissing(filePath: string): Promise<void> {
  try {
    await stat(filePath);
    throw new Error(`Expected path to be missing: ${filePath}`);
  } catch (error) {
    expect(error).toMatchObject({ code: 'ENOENT' });
  }
}
