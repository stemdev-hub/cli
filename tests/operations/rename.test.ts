import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renameBlock } from '../../src/core/operations/rename.js';

describe('renameBlock', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-rename-'));
    await createStemProject(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('renames a block ID and updates view and dependency references', async () => {
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
tags:
  - backend
---
Auth block.
`
    );
    await writeProjectFile(
      testRoot,
      'blocks/api.md',
      `---
id: api
depends-on:
  - auth
  - auth#summary.api
---
API block.
`
    );
    await writeProjectFile(
      testRoot,
      'views/api.md',
      `---
id: api-view
---
@stem[block:auth]
@stem[block:auth section=summary tag=api]

\`@stem[block:auth]\`

\`\`\`md
@stem[block:auth]
\`\`\`
`
    );

    const result = await renameBlock('auth', 'auth-v2', { startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        oldId: 'auth',
        newId: 'auth-v2',
        blockFilePath: path.join(testRoot, 'blocks/auth.md'),
        updatedFiles: [
          path.join(testRoot, 'blocks/api.md'),
          path.join(testRoot, 'blocks/auth.md'),
          path.join(testRoot, 'views/api.md')
        ].sort(),
        updatedRefCount: 4
      });
    }

    await expect(readFile(path.join(testRoot, 'blocks/auth.md'), 'utf8')).resolves.toContain('id: auth-v2');
    await expect(readFile(path.join(testRoot, 'blocks/api.md'), 'utf8')).resolves.toContain(
      `depends-on:
  - auth-v2
  - auth-v2#summary.api`
    );
    await expect(readFile(path.join(testRoot, 'views/api.md'), 'utf8')).resolves.toBe(
      `---
id: api-view
---
@stem[block:auth-v2]
@stem[block:auth-v2 section=summary tag=api]

\`@stem[block:auth]\`

\`\`\`md
@stem[block:auth]
\`\`\`
`
    );
  });

  it('returns a conflict when the new block ID already exists', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'blocks/api.md', '---\nid: api\n---\nAPI block.\n');

    const result = await renameBlock('auth', 'api', { startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' }
    });
  });

  it('returns an operation error when the old block does not exist', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');

    const result = await renameBlock('missing', 'auth-v2', { startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
  });

  it('rejects invalid new IDs', async () => {
    const result = await renameBlock('auth', 'bad id', { startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INVALID_OPERATION' }
    });
  });

  it('returns an operation error when no project root exists', async () => {
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'stem-rename-outside-'));

    try {
      const result = await renameBlock('auth', 'auth-v2', { startDir: outsideRoot });

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
