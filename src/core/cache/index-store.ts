import path from 'node:path';

import type {
  BlockParameter,
  CachedBlock,
  CachedBlockRef,
  CachedSection,
  CachedTag,
  CachedView,
  CacheIndex,
  CacheIndexEntry,
  ParsedBlock,
  ParsedView,
  ResolvedStemConfig
} from '@stem/types';
import { readFile } from '../fs/reader.js';
import { ensureDir, writeFile } from '../fs/writer.js';
import { cacheError } from './errors.js';
import type { CacheResult } from './errors.js';

export const CACHE_VERSION = '2';

const CACHE_INDEX_FILE = 'index.json';

export function createEmptyCacheIndex(): CacheIndex {
  return {
    version: CACHE_VERSION,
    entries: {}
  };
}

export async function readCacheIndex(
  projectRoot: string,
  config: ResolvedStemConfig
): Promise<CacheResult<CacheIndex>> {
  const indexPath = getCacheIndexPath(projectRoot, config);
  const readResult = await readFile(indexPath);

  if (!readResult.success) {
    if (readResult.error.code === 'NOT_FOUND') {
      return { success: true, data: createEmptyCacheIndex() };
    }

    return {
      success: false,
      error: cacheError('CACHE_READ_FAILED', `Failed to read cache index at ${indexPath}.`, indexPath)
    };
  }

  const parseResult = parseCacheIndex(readResult.data, indexPath);
  if (!parseResult.success) {
    return parseResult;
  }

  if (parseResult.data.version !== CACHE_VERSION) {
    return { success: true, data: createEmptyCacheIndex() };
  }

  if (!isCacheEntriesShape(parseResult.data)) {
    return {
      success: false,
      error: cacheError('CACHE_INVALID_SCHEMA', 'Cache index contains invalid parsed entry data.', indexPath)
    };
  }

  return parseResult;
}

export async function writeCacheIndex(
  projectRoot: string,
  config: ResolvedStemConfig,
  index: CacheIndex
): Promise<CacheResult<void>> {
  const indexPath = getCacheIndexPath(projectRoot, config);
  const ensureDirResult = await ensureDir(path.dirname(indexPath));

  if (!ensureDirResult.success) {
    return {
      success: false,
      error: cacheError('CACHE_WRITE_FAILED', `Failed to create cache directory for ${indexPath}.`, indexPath)
    };
  }

  const writeResult = await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, { overwrite: true });

  if (!writeResult.success) {
    return {
      success: false,
      error: cacheError('CACHE_WRITE_FAILED', `Failed to write cache index at ${indexPath}.`, indexPath)
    };
  }

  return { success: true, data: undefined };
}

export function upsertCacheEntry(index: CacheIndex, entry: CacheIndexEntry): CacheIndex {
  return {
    ...index,
    entries: {
      ...index.entries,
      [entry.relativePath]: entry
    }
  };
}

export function removeCacheEntry(index: CacheIndex, relativePath: string): CacheIndex {
  const entries = { ...index.entries };
  delete entries[relativePath];

  return {
    ...index,
    entries
  };
}

export function toCachedBlock(parsed: ParsedBlock): CachedBlock {
  return {
    id: parsed.id,
    tags: [...parsed.tags],
    dependsOn: parsed.dependsOn.map((dependency) => ({ ...dependency })),
    sections: parsed.sections.map(toCachedSection),
    standaloneTags: parsed.standaloneTags.map(toCachedTag)
  };
}

export function toCachedView(parsed: ParsedView): CachedView {
  return {
    id: parsed.id,
    group: parsed.group,
    blockRefs: parsed.blockRefs.map((blockRef) => ({
      blockId: blockRef.blockId,
      section: blockRef.section,
      tag: blockRef.tag,
      parameters: blockRef.parameters.map((parameter) => ({ ...parameter })),
      syntax: blockRef.syntax,
      raw: blockRef.raw
    }))
  };
}

function getCacheIndexPath(projectRoot: string, config: ResolvedStemConfig): string {
  return path.join(projectRoot, config.cacheDir, CACHE_INDEX_FILE);
}

function parseCacheIndex(content: string, indexPath: string): CacheResult<CacheIndex> {
  try {
    const parsed: unknown = JSON.parse(content);

    if (!isCacheIndexShape(parsed)) {
      return {
        success: false,
        error: cacheError('CACHE_INVALID_SCHEMA', 'Cache index must contain string version and object entries.', indexPath)
      };
    }

    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: cacheError(
        'CACHE_INVALID_JSON',
        error instanceof Error ? `Invalid cache index JSON: ${error.message}` : 'Invalid cache index JSON.',
        indexPath
      )
    };
  }
}

function toCachedSection(section: ParsedBlock['sections'][number]): CachedSection {
  return {
    name: section.name,
    tags: section.tags.map(toCachedTag),
    externalTags: section.externalTags.map(toCachedTag),
    prose: section.prose
  };
}

function toCachedTag(tag: ParsedBlock['standaloneTags'][number]): CachedTag {
  return {
    name: tag.name,
    section: tag.section,
    content: tag.content
  };
}

function isCacheIndexShape(value: unknown): value is CacheIndex {
  return isPlainObject(value) && typeof value['version'] === 'string' && isPlainObject(value['entries']);
}

function isCacheEntriesShape(index: CacheIndex): boolean {
  return Object.values(index.entries).every((entry) => {
    if (!isPlainObject(entry.parsed)) {
      return false;
    }

    if (entry.type === 'view') {
      return isCachedViewShape(entry.parsed);
    }

    return entry.type === 'block';
  });
}

function isCachedViewShape(value: unknown): value is CachedView {
  if (!isPlainObject(value) || !Array.isArray(value['blockRefs'])) {
    return false;
  }

  return value['blockRefs'].every((blockRef) => isCachedBlockRefShape(blockRef));
}

function isCachedBlockRefShape(value: unknown): value is CachedBlockRef {
  if (!isPlainObject(value)) {
    return false;
  }
  const syntax = value['syntax'];
  const parameters = value['parameters'];
  return (
    typeof value['blockId'] === 'string' &&
    (value['section'] === null || typeof value['section'] === 'string') &&
    (value['tag'] === null || typeof value['tag'] === 'string') &&
    typeof value['raw'] === 'string' &&
    (syntax === 'legacy' || syntax === 'extended') &&
    Array.isArray(parameters) &&
    parameters.every((parameter) => isBlockParameterShape(parameter))
  );
}

function isBlockParameterShape(value: unknown): value is BlockParameter {
  return (
    isPlainObject(value) &&
    typeof value['name'] === 'string' &&
    typeof value['value'] === 'string' &&
    /^[A-Za-z][A-Za-z0-9_-]*$/.test(value['name']) &&
    !['__proto__', 'constructor', 'prototype'].includes(value['name'])
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
