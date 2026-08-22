import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addBlockToView } from '../../src/core/operations/add.js';

describe('addBlockToView', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-add-'));
    await createStemProject(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('appends an unfiltered block reference to a view', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\nIntro.\n');

    const result = await addBlockToView('auth', 'api-view', { startDir: testRoot });

    expect(result).toEqual({
      success: true,
      data: {
        blockId: 'auth',
        viewId: 'api-view',
        viewFilePath: path.join(testRoot, 'views/api.md'),
        section: null,
        tag: null,
        refString: '@stem[block:auth]'
      }
    });
    await expect(readFile(path.join(testRoot, 'views/api.md'), 'utf8')).resolves.toBe(
      `---
id: api-view
---
Intro.

@stem[block:auth]
`
    );
  });

  it('appends a section and tag filtered block reference', async () => {
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
---
@stem[section:summary]
@stem[tag:api]
Endpoint summary.
@stem[end]
@stem[end]
`
    );
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n');

    const result = await addBlockToView('auth', 'api-view', {
      startDir: testRoot,
      section: 'summary',
      tag: 'api'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        section: 'summary',
        tag: 'api',
        refString: '@stem[block:auth section=summary tag=api]'
      });
    }
    await expect(readFile(path.join(testRoot, 'views/api.md'), 'utf8')).resolves.toContain(
      '@stem[block:auth section=summary tag=api]'
    );
  });

  it('returns an operation error for missing block or view IDs', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n');

    await expect(addBlockToView('missing', 'api-view', { startDir: testRoot })).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
    await expect(addBlockToView('auth', 'missing-view', { startDir: testRoot })).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
  });

  it('rejects invalid or unresolved filters', async () => {
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
---
@stem[section:summary]
@stem[tag:api]
Endpoint summary.
@stem[end]
@stem[end]
`
    );
    await writeProjectFile(testRoot, 'views/api.md', '---\nid: api-view\n---\n');

    await expect(addBlockToView('auth', 'api-view', { startDir: testRoot, tag: 'api' })).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
    await expect(
      addBlockToView('auth', 'api-view', { startDir: testRoot, section: 'missing' })
    ).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
    await expect(
      addBlockToView('auth', 'api-view', { startDir: testRoot, section: 'summary', tag: 'bad tag' })
    ).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
  });

  it('returns an operation error when no project root exists', async () => {
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'stem-add-outside-'));

    try {
      const result = await addBlockToView('auth', 'api-view', { startDir: outsideRoot });

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
