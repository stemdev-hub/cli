import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createBlock, createGroup, createView } from '../../src/core/operations/create.js';

describe('create operations', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-create-'));
    await createStemProject(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('creates a block with a normalized block id and Markdown file', async () => {
    const result = await createBlock('Auth Flow', { startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        id: 'auth-flow-block',
        filePath: path.join(testRoot, 'blocks/auth-flow-block.md'),
        relativePath: 'blocks/auth-flow-block.md',
        scaffolded: false,
        scaffoldedTag: null
      });
    }
    await expect(readFile(path.join(testRoot, 'blocks/auth-flow-block.md'), 'utf8')).resolves.toBe(
      `---
id: auth-flow-block
---
`
    );
  });

  it('does not duplicate an existing block suffix', async () => {
    const result = await createBlock('auth-flow-block', { startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('auth-flow-block');
    }
  });

  it('creates a block scaffolded with a tag', async () => {
    const result = await createBlock('API Auth', { startDir: testRoot, tag: 'api' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scaffolded).toBe(true);
      expect(result.data.scaffoldedTag).toBe('api');
    }
    await expect(readFile(path.join(testRoot, 'blocks/api-auth-block.md'), 'utf8')).resolves.toContain(
      '@stem[tag:api]'
    );
  });

  it('creates a view inside an optional group', async () => {
    const result = await createView('Auth Service', {
      startDir: testRoot,
      group: 'by-audience/backend'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        id: 'auth-service-view',
        filePath: path.join(testRoot, 'views/by-audience/backend/auth-service-view.md'),
        relativePath: 'views/by-audience/backend/auth-service-view.md',
        group: 'by-audience/backend'
      });
    }
    await expect(
      readFile(path.join(testRoot, 'views/by-audience/backend/auth-service-view.md'), 'utf8')
    ).resolves.toBe(
      `---
id: auth-service-view
group: by-audience/backend
---
`
    );
  });

  it('creates a view group directory', async () => {
    const result = await createGroup('by-audience/backend', { startDir: testRoot });

    expect(result).toEqual({
      success: true,
      data: {
        groupPath: 'by-audience/backend',
        absolutePath: path.join(testRoot, 'views/by-audience/backend')
      }
    });
  });

  it('returns a conflict when the target file already exists', async () => {
    await createBlock('auth', { startDir: testRoot });

    const result = await createBlock('auth', { startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'CONFLICT',
        path: path.join(testRoot, 'blocks/auth-block.md')
      }
    });
  });

  it('rejects invalid names and group paths', async () => {
    await expect(createBlock('---', { startDir: testRoot })).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
    await expect(createView('auth', { startDir: testRoot, group: '../outside' })).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
  });

  it('returns an operation error when no project root exists', async () => {
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'stem-create-outside-'));

    try {
      const result = await createView('auth', { startDir: outsideRoot });

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
