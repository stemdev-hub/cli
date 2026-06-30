import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listBlocks, listViews } from '../../src/core/operations/list.js';

describe('list operations', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-list-'));
    await createStemProject(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('lists blocks with graph-backed usage metadata', async () => {
    await writeProjectFile(
      testRoot,
      'blocks/auth.md',
      `---
id: auth
tags:
  - backend
  - security
---
@stem[section:summary]
Auth summary.
@stem[end]

@stem[tag:api]
endpoint
@stem[end]
`
    );
    await writeProjectFile(testRoot, 'blocks/billing.md', '---\nid: billing\n---\nBilling block.\n');
    await writeProjectFile(
      testRoot,
      'views/api.md',
      `---
id: api-view
---
@stem[block:auth]
@stem[block:auth section=summary]
`
    );

    const result = await listBlocks({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(2);
      expect(result.data.blocks).toEqual([
        {
          id: 'auth',
          tags: ['backend', 'security'],
          relativePath: 'blocks/auth.md',
          usedInViews: ['api-view'],
          sectionCount: 1,
          standaloneTagCount: 1
        },
        {
          id: 'billing',
          tags: [],
          relativePath: 'blocks/billing.md',
          usedInViews: [],
          sectionCount: 0,
          standaloneTagCount: 0
        }
      ]);
    }
  });

  it('lists views with referenced block IDs', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'blocks/billing.md', '---\nid: billing\n---\nBilling block.\n');
    await writeProjectFile(
      testRoot,
      'views/api.md',
      `---
id: api-view
group: backend
---
@stem[block:auth]
@stem[block:billing]
@stem[block:auth section=summary]
`
    );
    await writeProjectFile(testRoot, 'views/empty.md', '---\nid: empty-view\n---\nNo refs.\n');

    const result = await listViews({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        total: 2,
        views: [
          {
            id: 'api-view',
            group: 'backend',
            relativePath: 'views/api.md',
            blockCount: 2,
            blockIds: ['auth', 'billing']
          },
          {
            id: 'empty-view',
            group: null,
            relativePath: 'views/empty.md',
            blockCount: 0,
            blockIds: []
          }
        ]
      });
    }
  });

  it('does not require valid schema files to list project metadata', async () => {
    await writeProjectFile(testRoot, 'blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile(testRoot, 'blocks/schemas/broken.yaml', 'required: api\n');

    const result = await listBlocks({ startDir: testRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(1);
    }
  });

  it('returns an operation error when no project root exists', async () => {
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'stem-list-outside-'));

    try {
      const result = await listViews({ startDir: outsideRoot });

      expect(result).toMatchObject({
        success: false,
        error: {
          code: 'PROJECT_ROOT_NOT_FOUND'
        }
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
