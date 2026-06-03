import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ResolvedStemConfig } from '../../src/core/types/index.js';
import { findBlockFiles, findProjectRoot, findSchemaFiles, findViewFiles } from '../../src/core/fs/finder.js';
import { toRelativePath } from '../../src/core/fs/reader.js';

describe('finder', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-finder-'));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('finds the project root when .stem exists in the current directory', async () => {
    await mkdir(path.join(testRoot, '.stem'), { recursive: true });

    const result = await findProjectRoot(testRoot);

    expect(result).toEqual({ success: true, data: testRoot });
  });

  it('finds the project root when .stem exists in a parent directory', async () => {
    const nestedDir = path.join(testRoot, 'blocks', 'nested');
    await mkdir(path.join(testRoot, '.stem'), { recursive: true });
    await mkdir(nestedDir, { recursive: true });

    const result = await findProjectRoot(nestedDir);

    expect(result).toEqual({ success: true, data: testRoot });
  });

  it('returns NO_PROJECT_ROOT when no .stem directory exists before the filesystem root', async () => {
    const result = await findProjectRoot(testRoot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NO_PROJECT_ROOT');
      expect(result.error.path).toBe(testRoot);
    }
  });

  it('finds all markdown block files recursively', async () => {
    const config = createConfig(testRoot);
    await writeProjectFile(testRoot, 'blocks/auth.md', '');
    await writeProjectFile(testRoot, 'blocks/nested/billing.md', '');

    const result = await findBlockFiles(testRoot, config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(toRelativePaths(result.data, testRoot)).toEqual(['blocks/auth.md', 'blocks/nested/billing.md']);
    }
  });

  it('excludes schema files from block file results', async () => {
    const config = createConfig(testRoot);
    await writeProjectFile(testRoot, 'blocks/auth.md', '');
    await writeProjectFile(testRoot, 'blocks/schemas/api.yaml', '');
    await writeProjectFile(testRoot, 'blocks/schemas/not-a-block.md', '');

    const result = await findBlockFiles(testRoot, config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(toRelativePaths(result.data, testRoot)).toEqual(['blocks/auth.md']);
    }
  });

  it('excludes hidden folders from results', async () => {
    const config = createConfig(testRoot);
    await writeProjectFile(testRoot, 'blocks/auth.md', '');
    await writeProjectFile(testRoot, 'blocks/.drafts/secret.md', '');

    const result = await findBlockFiles(testRoot, config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(toRelativePaths(result.data, testRoot)).toEqual(['blocks/auth.md']);
    }
  });

  it('excludes ignored folders from results', async () => {
    const config = createConfig(testRoot);
    await writeProjectFile(testRoot, 'blocks/auth.md', '');
    await writeProjectFile(testRoot, 'blocks/node_modules/pkg/readme.md', '');
    await writeProjectFile(testRoot, 'blocks/dist/generated.md', '');
    await writeProjectFile(testRoot, 'blocks/.stem/cache/graph.md', '');

    const result = await findBlockFiles(testRoot, config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(toRelativePaths(result.data, testRoot)).toEqual(['blocks/auth.md']);
    }
  });

  it('returns block files sorted alphabetically by relative path', async () => {
    const config = createConfig(testRoot);
    await writeProjectFile(testRoot, 'blocks/zeta.md', '');
    await writeProjectFile(testRoot, 'blocks/alpha.md', '');
    await writeProjectFile(testRoot, 'blocks/nested/beta.md', '');

    const result = await findBlockFiles(testRoot, config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(toRelativePaths(result.data, testRoot)).toEqual([
        'blocks/alpha.md',
        'blocks/nested/beta.md',
        'blocks/zeta.md'
      ]);
    }
  });

  it('finds all markdown view files recursively', async () => {
    const config = createConfig(testRoot);
    await writeProjectFile(testRoot, 'views/api.md', '');
    await writeProjectFile(testRoot, 'views/teams/backend.md', '');
    await writeProjectFile(testRoot, 'views/notes.txt', '');

    const result = await findViewFiles(testRoot, config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(toRelativePaths(result.data, testRoot)).toEqual(['views/api.md', 'views/teams/backend.md']);
    }
  });

  it('finds all YAML schema files recursively', async () => {
    const config = createConfig(testRoot);
    await writeProjectFile(testRoot, 'blocks/schemas/api.yaml', '');
    await writeProjectFile(testRoot, 'blocks/schemas/nested/summary.yml', '');
    await writeProjectFile(testRoot, 'blocks/schemas/readme.md', '');

    const result = await findSchemaFiles(testRoot, config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(toRelativePaths(result.data, testRoot)).toEqual([
        'blocks/schemas/api.yaml',
        'blocks/schemas/nested/summary.yml'
      ]);
    }
  });

  it('returns an empty array when block and view folders are empty', async () => {
    const config = createConfig(testRoot);
    await mkdir(path.join(testRoot, 'blocks'), { recursive: true });
    await mkdir(path.join(testRoot, 'views'), { recursive: true });

    const blockResult = await findBlockFiles(testRoot, config);
    const viewResult = await findViewFiles(testRoot, config);

    expect(blockResult).toEqual({ success: true, data: [] });
    expect(viewResult).toEqual({ success: true, data: [] });
  });
});

function createConfig(projectRoot: string): ResolvedStemConfig {
  return {
    version: '1',
    blocksDir: 'blocks',
    viewsDir: 'views',
    projectRoot,
    schemasDir: 'blocks/schemas',
    cacheDir: '.stem/cache'
  };
}

async function writeProjectFile(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, ...relativePath.split('/'));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function toRelativePaths(filePaths: string[], projectRoot: string): string[] {
  return filePaths.map((filePath) => toRelativePath(filePath, projectRoot));
}
