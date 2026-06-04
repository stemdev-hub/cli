import path from 'node:path';

import type { GraphSnapshot, ResolvedStemConfig } from '@stem/types';
import { readFile } from '../fs/reader.js';
import { ensureDir, writeFile } from '../fs/writer.js';
import { cacheError } from './errors.js';
import type { CacheResult } from './errors.js';

export const GRAPH_SNAPSHOT_VERSION = '1';

const GRAPH_SNAPSHOT_FILE = 'graph.json';

export function createEmptyGraphSnapshot(): GraphSnapshot {
  return {
    version: GRAPH_SNAPSHOT_VERSION,
    generatedAt: '',
    nodes: [],
    edges: [],
    blockUsedInViews: {},
    viewUsesBlocks: {},
    blockDependsOn: {},
    blockDependents: {}
  };
}

export async function readGraphSnapshot(
  projectRoot: string,
  config: ResolvedStemConfig
): Promise<CacheResult<GraphSnapshot | null>> {
  const snapshotPath = getGraphSnapshotPath(projectRoot, config);
  const readResult = await readFile(snapshotPath);

  if (!readResult.success) {
    if (readResult.error.code === 'NOT_FOUND') {
      return { success: true, data: null };
    }

    return {
      success: false,
      error: cacheError('CACHE_READ_FAILED', `Failed to read graph snapshot at ${snapshotPath}.`, snapshotPath)
    };
  }

  const parseResult = parseGraphSnapshot(readResult.data, snapshotPath);
  if (!parseResult.success) {
    return parseResult;
  }

  if (parseResult.data.version !== GRAPH_SNAPSHOT_VERSION) {
    return { success: true, data: null };
  }

  return parseResult;
}

export async function writeGraphSnapshot(
  projectRoot: string,
  config: ResolvedStemConfig,
  snapshot: GraphSnapshot
): Promise<CacheResult<void>> {
  const snapshotPath = getGraphSnapshotPath(projectRoot, config);
  const ensureDirResult = await ensureDir(path.dirname(snapshotPath));

  if (!ensureDirResult.success) {
    return {
      success: false,
      error: cacheError('CACHE_WRITE_FAILED', `Failed to create cache directory for ${snapshotPath}.`, snapshotPath)
    };
  }

  const writeResult = await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, { overwrite: true });

  if (!writeResult.success) {
    return {
      success: false,
      error: cacheError('CACHE_WRITE_FAILED', `Failed to write graph snapshot at ${snapshotPath}.`, snapshotPath)
    };
  }

  return { success: true, data: undefined };
}

function getGraphSnapshotPath(projectRoot: string, config: ResolvedStemConfig): string {
  return path.join(projectRoot, config.cacheDir, GRAPH_SNAPSHOT_FILE);
}

function parseGraphSnapshot(content: string, snapshotPath: string): CacheResult<GraphSnapshot> {
  try {
    const parsed: unknown = JSON.parse(content);

    if (!isGraphSnapshotShape(parsed)) {
      return {
        success: false,
        error: cacheError(
          'CACHE_INVALID_SCHEMA',
          'Graph snapshot must contain version, nodes, edges, and graph adjacency maps.',
          snapshotPath
        )
      };
    }

    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: cacheError(
        'CACHE_INVALID_JSON',
        error instanceof Error ? `Invalid graph snapshot JSON: ${error.message}` : 'Invalid graph snapshot JSON.',
        snapshotPath
      )
    };
  }
}

function isGraphSnapshotShape(value: unknown): value is GraphSnapshot {
  return (
    isPlainObject(value) &&
    typeof value['version'] === 'string' &&
    Array.isArray(value['nodes']) &&
    Array.isArray(value['edges']) &&
    isPlainObject(value['blockUsedInViews']) &&
    isPlainObject(value['viewUsesBlocks']) &&
    isPlainObject(value['blockDependsOn']) &&
    isPlainObject(value['blockDependents'])
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
