import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { previewView } from '../../src/core/operations/preview.js';

let testRoot: string;

describe('previewView', () => {
  beforeEach(async () => {
    testRoot = path.join(tmpdir(), `stem-preview-${randomUUID()}`);
    await mkdir(testRoot, { recursive: true });
    await createStemProject(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('returns rendered Markdown without writing output files', async () => {
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth content.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await previewView('api-view', { startDir: testRoot });

    expect(result).toMatchObject({
      success: true,
      data: {
        outDir: null,
        views: [{ id: 'api-view', outputPath: null, markdown: '---\nid: api-view\n---\nAuth content.\n' }]
      }
    });
    await expectPathMissing(path.join(testRoot, 'rendered/api.md'));
  });

  it('uses render validation behavior', async () => {
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:missing]\n');

    const result = await previewView('api-view', { startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_OPERATION',
        message: 'Cannot render project with 1 validation error. Run stem check for details.'
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

async function expectPathMissing(filePath: string): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
    throw new Error(`Expected path to be missing: ${filePath}`);
  } catch (error) {
    expect(error).toMatchObject({ code: 'ENOENT' });
  }
}
