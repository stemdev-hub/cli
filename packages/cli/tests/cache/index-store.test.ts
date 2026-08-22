import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CacheIndexEntry, ParsedBlock, ParsedView, ResolvedStemConfig } from '../../src/core/types/index.js';
import {
  CACHE_VERSION,
  createEmptyCacheIndex,
  readCacheIndex,
  removeCacheEntry,
  toCachedBlock,
  toCachedView,
  upsertCacheEntry,
  writeCacheIndex
} from '../../src/core/cache/index-store.js';

describe('index-store', () => {
  let testRoot: string;
  let config: ResolvedStemConfig;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-cache-index-'));
    config = createConfig(testRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('createEmptyCacheIndex returns the current version and empty entries', () => {
    expect(createEmptyCacheIndex()).toEqual({ version: CACHE_VERSION, entries: {} });
  });

  it('readCacheIndex returns an empty cache when the index file is missing', async () => {
    const result = await readCacheIndex(testRoot, config);

    expect(result).toEqual({ success: true, data: createEmptyCacheIndex() });
  });

  it('readCacheIndex returns CACHE_INVALID_JSON for invalid JSON', async () => {
    await writeCacheFile(testRoot, config, 'index.json', '{ broken json');

    const result = await readCacheIndex(testRoot, config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CACHE_INVALID_JSON');
    }
  });

  it('readCacheIndex returns CACHE_INVALID_SCHEMA for invalid shape', async () => {
    await writeCacheFile(testRoot, config, 'index.json', '{"version":"1","entries":[]}');

    const result = await readCacheIndex(testRoot, config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CACHE_INVALID_SCHEMA');
    }
  });

  it('readCacheIndex returns an empty cache for an unsupported version', async () => {
    await writeCacheFile(testRoot, config, 'index.json', '{"version":"999","entries":{"blocks/a.md":{}}}');

    const result = await readCacheIndex(testRoot, config);

    expect(result).toEqual({ success: true, data: createEmptyCacheIndex() });
  });

  it('readCacheIndex returns a valid cache index from disk', async () => {
    const index = upsertCacheEntry(createEmptyCacheIndex(), createEntry('blocks/a.md'));
    await writeCacheFile(testRoot, config, 'index.json', `${JSON.stringify(index)}\n`);

    const result = await readCacheIndex(testRoot, config);

    expect(result).toEqual({ success: true, data: index });
  });

  it('writeCacheIndex creates the cache directory when missing', async () => {
    const result = await writeCacheIndex(testRoot, config, createEmptyCacheIndex());

    expect(result).toEqual({ success: true, data: undefined });
    await expect(readFile(path.join(testRoot, config.cacheDir, 'index.json'), 'utf8')).resolves.toContain('"entries"');
  });

  it('writeCacheIndex writes correct JSON to disk', async () => {
    const index = upsertCacheEntry(createEmptyCacheIndex(), createEntry('blocks/a.md'));

    const result = await writeCacheIndex(testRoot, config, index);

    expect(result).toEqual({ success: true, data: undefined });
    await expect(readFile(path.join(testRoot, config.cacheDir, 'index.json'), 'utf8')).resolves.toBe(
      `${JSON.stringify(index, null, 2)}\n`
    );
  });

  it('writeCacheIndex overwrites an existing cache file', async () => {
    await writeCacheFile(testRoot, config, 'index.json', '{"version":"old","entries":{}}');
    const index = upsertCacheEntry(createEmptyCacheIndex(), createEntry('blocks/a.md'));

    const result = await writeCacheIndex(testRoot, config, index);

    expect(result).toEqual({ success: true, data: undefined });
    await expect(readFile(path.join(testRoot, config.cacheDir, 'index.json'), 'utf8')).resolves.toBe(
      `${JSON.stringify(index, null, 2)}\n`
    );
  });

  it('upsertCacheEntry returns a new index with an entry added', () => {
    const index = createEmptyCacheIndex();
    const entry = createEntry('blocks/a.md');

    const updated = upsertCacheEntry(index, entry);

    expect(updated.entries['blocks/a.md']).toEqual(entry);
    expect(updated).not.toBe(index);
  });

  it('upsertCacheEntry returns a new index with an entry replaced', () => {
    const index = upsertCacheEntry(createEmptyCacheIndex(), createEntry('blocks/a.md', 'old'));
    const replacement = createEntry('blocks/a.md', 'new');

    const updated = upsertCacheEntry(index, replacement);

    expect(updated.entries['blocks/a.md']).toEqual(replacement);
  });

  it('upsertCacheEntry does not mutate the input index', () => {
    const index = createEmptyCacheIndex();

    upsertCacheEntry(index, createEntry('blocks/a.md'));

    expect(index.entries).toEqual({});
  });

  it('removeCacheEntry returns a new index without the entry', () => {
    const index = upsertCacheEntry(createEmptyCacheIndex(), createEntry('blocks/a.md'));

    const updated = removeCacheEntry(index, 'blocks/a.md');

    expect(updated.entries).toEqual({});
    expect(updated).not.toBe(index);
  });

  it('removeCacheEntry is a no-op when the key is not found', () => {
    const index = upsertCacheEntry(createEmptyCacheIndex(), createEntry('blocks/a.md'));

    const updated = removeCacheEntry(index, 'blocks/missing.md');

    expect(updated).toEqual(index);
    expect(updated).not.toBe(index);
  });

  it('removeCacheEntry does not mutate the input index', () => {
    const entry = createEntry('blocks/a.md');
    const index = upsertCacheEntry(createEmptyCacheIndex(), entry);

    removeCacheEntry(index, 'blocks/a.md');

    expect(index.entries['blocks/a.md']).toEqual(entry);
  });

  it('toCachedBlock strips positions and runtime-only fields', () => {
    const cached = toCachedBlock(createParsedBlock());

    expect(cached).toEqual({
      id: 'auth-block',
      tags: ['auth'],
      dependsOn: [{ blockId: 'users-block', section: null, tag: null, raw: 'users-block' }],
      sections: [
        {
          name: 'auth-flow',
          prose: 'Section prose',
          tags: [{ name: 'summary', section: null, content: 'Summary' }],
          externalTags: [{ name: 'detail', section: 'auth-flow', content: 'Detail' }]
        }
      ],
      standaloneTags: [{ name: 'api', section: null, content: 'API' }]
    });
  });

  it('toCachedView strips positions and runtime-only fields', () => {
    const cached = toCachedView(createParsedView());

    expect(cached).toEqual({
      id: 'auth-view',
      group: 'backend',
      blockRefs: [
        {
          namespace: null,
          blockId: 'auth-block',
          section: 'auth-flow',
          tag: 'summary',
          parameters: [],
          syntax: 'legacy',
          raw: '@stem[block:auth-block]'
        }
      ]
    });
  });

  it('toCachedView preserves parameterized block metadata', () => {
    const cached = toCachedView({
      ...createParsedView(),
      blockRefs: [
        {
          namespace: null,
          blockId: 'db-setup',
          section: 'setup',
          tag: null,
          parameters: [{ name: 'db_name', value: 'PostgreSQL' }],
          syntax: 'extended',
          raw: '@stem[block:db-setup, section="setup", db_name="PostgreSQL"]',
          position: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 2 }
          }
        }
      ]
    });

    expect(cached.blockRefs[0]).toEqual({
      namespace: null,
      blockId: 'db-setup',
      section: 'setup',
      tag: null,
      parameters: [{ name: 'db_name', value: 'PostgreSQL' }],
      syntax: 'extended',
      raw: '@stem[block:db-setup, section="setup", db_name="PostgreSQL"]'
    });
  });

  it('readCacheIndex rejects cached dangerous parameter names', async () => {
    const index = upsertCacheEntry(createEmptyCacheIndex(), {
      ...createEntry('views/a.md'),
      type: 'view',
      parsed: {
        id: 'auth-view',
        group: null,
        blockRefs: [
          {
            namespace: null,
            blockId: 'auth-block',
            section: null,
            tag: null,
            parameters: [{ name: '__proto__', value: 'polluted' }],
            syntax: 'extended',
            raw: '@stem[block:auth-block, __proto__="polluted"]'
          }
        ]
      }
    });
    await writeCacheFile(testRoot, config, 'index.json', `${JSON.stringify(index)}\n`);

    const result = await readCacheIndex(testRoot, config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CACHE_INVALID_SCHEMA');
    }
  });
});

function createConfig(projectRoot: string): ResolvedStemConfig {
  return {
    version: '1',
    projectRoot,
    blocksDir: 'blocks',
    viewsDir: 'views',
    schemasDir: 'blocks/schemas',
    cacheDir: '.stem/cache',
    namespaces: {}
  };
}

function createEntry(relativePath: string, sha256: string = 'sha'): CacheIndexEntry {
  return {
    filePath: path.join('project', ...relativePath.split('/')),
    relativePath,
    type: 'block',
    dev: '1',
    inode: '2',
    size: 3,
    mtimeMs: 4,
    sha256,
    parsed: {
      id: 'auth-block',
      tags: [],
      dependsOn: [],
      sections: [],
      standaloneTags: []
    }
  };
}

async function writeCacheFile(
  projectRoot: string,
  config: ResolvedStemConfig,
  fileName: string,
  content: string
): Promise<void> {
  const filePath = path.join(projectRoot, config.cacheDir, fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function createParsedBlock(): ParsedBlock {
  const position = {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 2 }
  };

  return {
    id: 'auth-block',
    tags: ['auth'],
    dependsOn: [{ blockId: 'users-block', section: null, tag: null, raw: 'users-block' }],
    sections: [
      {
        name: 'auth-flow',
        prose: 'Section prose',
        proseRange: { startOffset: 0, endOffset: 13 },
        tags: [{ name: 'summary', section: null, content: 'Summary', contentRange: { startOffset: 0, endOffset: 7 }, position }],
        externalTags: [
          {
            name: 'detail',
            section: 'auth-flow',
            content: 'Detail',
            contentRange: { startOffset: 0, endOffset: 6 },
            position
          }
        ],
        position
      }
    ],
    standaloneTags: [{ name: 'api', section: null, content: 'API', contentRange: { startOffset: 0, endOffset: 3 }, position }],
    filePath: '/project/blocks/auth.md',
    relativePath: 'blocks/auth.md',
    rawContent: 'raw',
    bodyStartLine: 1
  };
}

function createParsedView(): ParsedView {
  return {
    id: 'auth-view',
    group: 'backend',
    blockRefs: [
      {
        namespace: null,
        blockId: 'auth-block',
        section: 'auth-flow',
        tag: 'summary',
        parameters: [],
        syntax: 'legacy',
        raw: '@stem[block:auth-block]',
        position: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 }
        }
      }
    ],
    filePath: '/project/views/auth.md',
    relativePath: 'views/auth.md',
    localContent: 'local',
    bodyStartLine: 1
  };
}
