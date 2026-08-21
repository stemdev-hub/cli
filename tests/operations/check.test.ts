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

  describe('external references (Phase 1+2 features)', () => {
    it('detects MISSING_SNAPSHOT for missing cache payloads', async () => {
      await createStemProject(testRoot);
      await writeProjectFile(
        testRoot,
        '.stem/config.json',
        JSON.stringify({
          version: '1',
          namespaces: { core: { graphUrl: 'https://example.com/graph.json' } }
        })
      );
      await writeProjectFile(
        testRoot,
        'views/api.md',
        '---\nid: test-view\n---\n@stem[block:core:auth]'
      );

      const result = await checkProject({ startDir: testRoot });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.validation.issues[0]).toMatchObject({
          code: 'MISSING_SNAPSHOT',
          severity: 'warning'
        });
      }
    });

    it('emits EXPIRED_SNAPSHOT if cache payload is too old', async () => {
      await createStemProject(testRoot);
      await writeProjectFile(
        testRoot,
        '.stem/config.json',
        JSON.stringify({ version: '1', namespaces: { core: { graphUrl: 'https://example.com' } } })
      );
      await writeProjectFile(testRoot, 'views/api.md', '---\nid: v\n---\n@stem[block:core:auth]');

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      await writeProjectFile(
        testRoot,
        '.stem/cache/namespaces/core.json',
        JSON.stringify({
          fetchedAt: eightDaysAgo,
          graph: {
            version: '1',
            namespace: 'core',
            publishedAt: new Date().toISOString(),
            contentSha: 'sha256:mock',
            blocks: [{ id: 'auth', tags: [], sections: [] }],
            renames: []
          }
        })
      );

      const result = await checkProject({ startDir: testRoot, strictExternal: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.validation.issues[0]).toMatchObject({
          code: 'EXPIRED_SNAPSHOT',
          severity: 'error'
        });
      }
    });

    it('emits BROKEN_BLOCK_REF with rename hint when referenced block was renamed', async () => {
      await createStemProject(testRoot);
      await writeProjectFile(
        testRoot,
        '.stem/config.json',
        JSON.stringify({ version: '1', namespaces: { core: { graphUrl: 'https://example.com' } } })
      );
      await writeProjectFile(testRoot, 'views/api.md', '---\nid: v\n---\n@stem[block:core:old-auth]');

      await writeProjectFile(
        testRoot,
        '.stem/cache/namespaces/core.json',
        JSON.stringify({
          fetchedAt: new Date().toISOString(),
          graph: {
            version: '1',
            namespace: 'core',
            publishedAt: new Date().toISOString(),
            contentSha: 'sha256:mock',
            blocks: [{ id: 'new-auth', tags: [], sections: [] }],
            renames: [{ from: 'old-auth', to: 'new-auth', since: new Date().toISOString() }]
          }
        })
      );

      const result = await checkProject({ startDir: testRoot });
      expect(result.success).toBe(true);
      if (result.success) {
        const issue = result.data.validation.issues[0];
        expect(issue?.code).toBe('BROKEN_BLOCK_REF');
        expect(issue?.message).toContain('It was renamed to "new-auth"');
      }
    });

    it('passes clean validation for valid external references', async () => {
      await createStemProject(testRoot);
      await writeProjectFile(
        testRoot,
        '.stem/config.json',
        JSON.stringify({ version: '1', namespaces: { core: { graphUrl: 'https://example.com' } } })
      );
      await writeProjectFile(testRoot, 'views/api.md', '---\nid: v\n---\n@stem[block:core:auth]');

      await writeProjectFile(
        testRoot,
        '.stem/cache/namespaces/core.json',
        JSON.stringify({
          fetchedAt: new Date().toISOString(),
          graph: {
            version: '1',
            namespace: 'core',
            publishedAt: new Date().toISOString(),
            contentSha: 'sha256:mock',
            blocks: [{ id: 'auth', tags: [], sections: [] }],
            renames: []
          }
        })
      );

      const result = await checkProject({ startDir: testRoot });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.validation.hasErrors).toBe(false);
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
