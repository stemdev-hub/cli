import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderAll, renderView } from '../../src/core/operations/render.js';

let testRoot: string;

describe('render operations', () => {
  beforeEach(async () => {
    testRoot = path.join(tmpdir(), `stem-render-${randomUUID()}`);
    await mkdir(testRoot, { recursive: true });
    await createStemProject(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('renders one view to the default rendered directory', async () => {
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth content.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\ngroup: backend\n---\n# API\n\n@stem[block:auth]\n');

    const result = await renderView('api-view', { startDir: testRoot });

    expect(result).toMatchObject({
      success: true,
      data: {
        total: 1,
        outDir: 'rendered',
        views: [{ id: 'api-view', outputRelativePath: 'rendered/api.md', markdown: null }]
      }
    });
    await expect(readProjectFile('rendered/api.md')).resolves.toBe(
      '---\nid: api-view\ngroup: backend\n---\n# API\n\nAuth content.\n'
    );
    await expect(readProjectFile('views/api.md')).resolves.toContain('@stem[block:auth]');
  });

  it('renders all views and preserves group paths', async () => {
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth content.\n');
    await writeProjectFile('views/backend/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');
    await writeProjectFile('views/ops/runbook.md', '---\nid: runbook-view\n---\nRunbook.\n');

    const result = await renderAll({ startDir: testRoot });

    expect(result).toMatchObject({
      success: true,
      data: {
        total: 2,
        views: [
          { id: 'api-view', outputRelativePath: 'rendered/backend/api.md' },
          { id: 'runbook-view', outputRelativePath: 'rendered/ops/runbook.md' }
        ]
      }
    });
  });

  it('renders to a custom output directory', async () => {
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth content.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await renderView('api-view', { startDir: testRoot, outDir: 'published' });

    expect(result).toMatchObject({
      success: true,
      data: { views: [{ outputRelativePath: 'published/api.md' }] }
    });
    await expect(readProjectFile('published/api.md')).resolves.toContain('Auth content.');
  });

  it('returns rendered Markdown without writing when stdout is requested', async () => {
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth content.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await renderView('api-view', { startDir: testRoot, stdout: true });

    expect(result).toMatchObject({
      success: true,
      data: {
        outDir: null,
        views: [{ outputPath: null, outputRelativePath: null, markdown: '---\nid: api-view\n---\nAuth content.\n' }]
      }
    });
    await expectPathMissing(path.join(testRoot, 'rendered/api.md'));
  });

  it('blocks rendering when validation has errors', async () => {
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:missing]\n');

    const result = await renderView('api-view', { startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_OPERATION',
        message: 'Cannot render project with 1 validation error. Run stem check for details.'
      }
    });
  });

  it('allows validation warnings', async () => {
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nOrphan content.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\nLocal.\n');

    const result = await renderView('api-view', { startDir: testRoot });

    expect(result.success).toBe(true);
  });

  it('returns an invalid operation for a missing view id', async () => {
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\nLocal.\n');

    const result = await renderView('missing-view', { startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_OPERATION',
        message: 'View "missing-view" was not found.'
      }
    });
  });
});

async function createStemProject(projectRoot: string): Promise<void> {
  await mkdir(path.join(projectRoot, '.stem'), { recursive: true });
  await mkdir(path.join(projectRoot, 'blocks'), { recursive: true });
  await mkdir(path.join(projectRoot, 'views'), { recursive: true });
  await mkdir(path.join(projectRoot, 'blocks/schemas'), { recursive: true });
}

async function writeProjectFile(relativePath: string, content: string): Promise<void> {
  const filePath = path.join(testRoot, ...relativePath.split('/'));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function readProjectFile(relativePath: string): Promise<string> {
  return readFile(path.join(testRoot, ...relativePath.split('/')), 'utf8');
}

async function expectPathMissing(filePath: string): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
    throw new Error(`Expected path to be missing: ${filePath}`);
  } catch (error) {
    expect(error).toMatchObject({ code: 'ENOENT' });
  }
}
