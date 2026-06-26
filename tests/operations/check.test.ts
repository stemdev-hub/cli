import { randomUUID } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkProject } from '../../src/core/operations/check.js';

describe('checkProject', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = path.join(tmpdir(), `stem-check-${randomUUID()}`);
    await mkdir(testRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('validates a project without writing cache files', async () => {
    await createStemProject(testRoot);
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
tags:
  - backend
---
@stem[section:summary]
@stem[tag:api]
endpoint response
@stem[end]
@stem[end]
`
    );
    await writeProjectFile(
      testRoot,
      'views/api.md',
      `---
id: api-view
group: backend
---
@stem[block:auth section=summary tag=api]
`
    );
    await writeProjectFile(
      testRoot,
      'blocks/schemas/api.yaml',
      `name: api
required:
  - endpoint
  - response
`
    );

    const result = await checkProject({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scannedFiles).toBe(2);
      expect(result.data.validation).toMatchObject({
        errorCount: 0,
        warningCount: 0,
        hasErrors: false,
        hasWarnings: false
      });
      expect(result.data.durationMs).toBeGreaterThanOrEqual(0);
    }
    await expectPathMissing(path.join(testRoot, '.stem/cache'));
  });

  it('merges parser, graph validation, and schema validation issues', async () => {
    await createStemProject(testRoot);
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
---
@stem[tag:api section=missing]
endpoint only
@stem[end]

@stem[tag:api]
endpoint only
@stem[end]
`
    );
    await writeProjectFile(
      testRoot,
      'views/api.md',
      `---
id: api-view
---
@stem[block:missing-block]
@stem[block:auth]
`
    );
    await writeProjectFile(
      testRoot,
      'blocks/schemas/api.yaml',
      `name: api
required:
  - endpoint
  - response
`
    );

    const result = await checkProject({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.validation.issues.map((issue) => issue.code)).toEqual([
        'EXTERNAL_TAG_MISSING_SECTION',
        'BROKEN_BLOCK_REF',
        'SCHEMA_VIOLATION',
        'SCHEMA_VIOLATION'
      ]);
      expect(result.data.validation.errorCount).toBe(4);
      expect(result.data.validation.warningCount).toBe(0);
    }
  });

  it('returns an operation error when no project root exists', async () => {
    const result = await checkProject({ startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'PROJECT_ROOT_NOT_FOUND'
      }
    });
  });

  it('returns an operation error for invalid schema files', async () => {
    await createStemProject(testRoot);
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
---
Plain block.
`
    );
    await writeProjectFile(testRoot, 'blocks/schemas/api.yaml', 'required: endpoint\n');

    const result = await checkProject({ startDir: testRoot });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'SCHEMA_LOAD_ERROR'
      }
    });
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
