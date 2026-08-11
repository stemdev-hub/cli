import { performance } from 'node:perf_hooks';
import path from 'node:path';

import type {
  CachedBlock,
  CachedTag,
  CachedView,
  CacheIndex,
  CacheIndexEntry,
  DiscoveredFile,
  FileInvalidation,
  FileStats,
  GraphSnapshot,
  OperationResult,
  ParsedBlock,
  ParsedView,
  Position,
  ProjectOperationOptions,
  ResolvedStemConfig,
  StemGraph,
  SyncResult
} from '@stem/types';
import { computeFileSha256, runInvalidation } from '../cache/invalidator.js';
import {
  readCacheIndex,
  removeCacheEntry,
  toCachedBlock,
  toCachedView,
  upsertCacheEntry,
  writeCacheIndex
} from '../cache/index-store.js';
import { GRAPH_SNAPSHOT_VERSION, writeGraphSnapshot } from '../cache/graph-store.js';
import { loadStemConfig } from '../config/index.js';
import { findBlockFiles, findProjectRoot, findViewFiles } from '../fs/finder.js';
import { readFile, readFileStats, toRelativePath } from '../fs/reader.js';
import { buildGraph } from '../graph/builder.js';
import { parseBlockFile, parseViewFile } from '../parser/index.js';
import { fromCacheError, fromConfigError, fromFsError } from './errors.js';

export async function syncProject(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<SyncResult>> {
  const startedAt = performance.now();
  const projectResult = await loadSyncProject(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const syncedResult = await syncParsedFiles(projectResult.data);
  if (!syncedResult.success) {
    return syncedResult;
  }

  const graphResult = buildGraph(syncedResult.data.blocks, syncedResult.data.views);
  const graphWriteResult = await writeGraphSnapshot(
    projectResult.data.projectRoot,
    projectResult.data.config,
    toGraphSnapshot(graphResult.graph)
  );
  if (!graphWriteResult.success) {
    return { success: false, error: fromCacheError(graphWriteResult.error) };
  }

  const indexWriteResult = await writeCacheIndex(
    projectResult.data.projectRoot,
    projectResult.data.config,
    syncedResult.data.index
  );
  if (!indexWriteResult.success) {
    return { success: false, error: fromCacheError(indexWriteResult.error) };
  }

  return {
    success: true,
    data: {
      scannedFiles: projectResult.data.files.length,
      parsedFiles: syncedResult.data.parsedFiles,
      cachedFiles: syncedResult.data.cachedFiles,
      graphNodes: graphResult.graph.nodes.size,
      graphEdges: graphResult.graph.edges.length,
      durationMs: Math.trunc(performance.now() - startedAt)
    }
  };
}

interface SyncProjectData {
  projectRoot: string;
  config: ResolvedStemConfig;
  files: DiscoveredFile[];
  stats: Map<string, FileStats>;
  index: CacheIndex;
}

interface SyncedParsedFiles {
  blocks: ParsedBlock[];
  views: ParsedView[];
  index: CacheIndex;
  parsedFiles: number;
  cachedFiles: number;
}

const ZERO_POSITION: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 }
};

async function loadSyncProject(
  options: ProjectOperationOptions
): Promise<OperationResult<SyncProjectData>> {
  const startDir = options.startDir ?? process.cwd();
  const projectRootResult = await findProjectRoot(startDir);
  if (!projectRootResult.success) {
    return { success: false, error: fromFsError(projectRootResult.error) };
  }

  const projectRoot = projectRootResult.data;
  const configResult = await loadStemConfig(projectRoot);
  if (!configResult.success) {
    return { success: false, error: fromConfigError(configResult.error) };
  }

  const blockFilesResult = await findBlockFiles(projectRoot, configResult.data);
  if (!blockFilesResult.success) {
    return { success: false, error: fromFsError(blockFilesResult.error) };
  }

  const viewFilesResult = await findViewFiles(projectRoot, configResult.data);
  if (!viewFilesResult.success) {
    return { success: false, error: fromFsError(viewFilesResult.error) };
  }

  const files = [
    ...toDiscoveredFiles(blockFilesResult.data, projectRoot, 'block'),
    ...toDiscoveredFiles(viewFilesResult.data, projectRoot, 'view')
  ];
  const statsResult = await readStats(files);
  if (!statsResult.success) {
    return statsResult;
  }

  const indexResult = await readCacheIndex(projectRoot, configResult.data);
  if (!indexResult.success) {
    return { success: false, error: fromCacheError(indexResult.error) };
  }

  return {
    success: true,
    data: {
      projectRoot,
      config: configResult.data,
      files,
      stats: statsResult.data,
      index: indexResult.data
    }
  };
}

async function syncParsedFiles(project: SyncProjectData): Promise<OperationResult<SyncedParsedFiles>> {
  const invalidation = await runInvalidation(project.files, project.stats, project.index);
  let index = project.index;
  const blocks: ParsedBlock[] = [];
  const views: ParsedView[] = [];
  let parsedFiles = 0;
  let cachedFiles = 0;

  for (const entry of invalidation.deleted) {
    index = removeCacheEntry(index, entry.relativePath);
  }

  for (const file of [...invalidation.added, ...invalidation.changed]) {
    const parsedResult = await parseFileInvalidation(file);
    if (!parsedResult.success) {
      return parsedResult;
    }

    const shaResult = await getInvalidationSha(file);
    if (!shaResult.success) {
      return shaResult;
    }

    const entry = toCacheEntry(file, shaResult.data, parsedResult.data);
    index = upsertCacheEntry(index, entry);
    addParsedFile(parsedResult.data, blocks, views);
    parsedFiles += 1;
  }

  for (const file of invalidation.metadataChanged) {
    if (file.cached === undefined) {
      continue;
    }

    const parsed = fromCacheEntry(file.cached);
    const entry = toCacheEntry(file, file.sha256 ?? file.cached.sha256, parsed);
    index = upsertCacheEntry(index, entry);
    addParsedFile(parsed, blocks, views);
    cachedFiles += 1;
  }

  for (const file of invalidation.unchanged) {
    if (file.cached === undefined) {
      continue;
    }

    addParsedFile(fromCacheEntry(file.cached), blocks, views);
    cachedFiles += 1;
  }

  return { success: true, data: { blocks, views, index, parsedFiles, cachedFiles } };
}

function toDiscoveredFiles(
  filePaths: string[],
  projectRoot: string,
  type: DiscoveredFile['type']
): DiscoveredFile[] {
  return filePaths.map((filePath) => ({
    filePath: path.resolve(filePath),
    relativePath: toRelativePath(filePath, projectRoot),
    type
  }));
}

async function readStats(files: DiscoveredFile[]): Promise<OperationResult<Map<string, FileStats>>> {
  const stats = new Map<string, FileStats>();

  for (const file of files) {
    const result = await readFileStats(file.filePath);
    if (!result.success) {
      return { success: false, error: fromFsError(result.error) };
    }

    stats.set(file.relativePath, result.data);
  }

  return { success: true, data: stats };
}

async function parseFileInvalidation(
  file: FileInvalidation
): Promise<OperationResult<ParsedBlock | ParsedView>> {
  const readResult = await readFile(file.filePath);
  if (!readResult.success) {
    return { success: false, error: fromFsError(readResult.error) };
  }

  if (file.type === 'block') {
    const { errors, ...block } = parseBlockFile({
      content: readResult.data,
      filePath: file.filePath,
      relativePath: file.relativePath
    });
    void errors;
    return { success: true, data: block };
  }

  const { errors, ...view } = parseViewFile({
    content: readResult.data,
    filePath: file.filePath,
    relativePath: file.relativePath
  });
  void errors;
  return { success: true, data: view };
}

async function getInvalidationSha(file: FileInvalidation): Promise<OperationResult<string>> {
  if (file.sha256 !== undefined) {
    return { success: true, data: file.sha256 };
  }

  const result = await computeFileSha256(file.filePath);
  if (!result.success) {
    return { success: false, error: fromCacheError(result.error) };
  }

  return { success: true, data: result.data };
}

function toCacheEntry(
  file: FileInvalidation,
  sha256: string,
  parsed: ParsedBlock | ParsedView
): CacheIndexEntry {
  return {
    filePath: file.filePath,
    relativePath: file.relativePath,
    type: file.type,
    dev: file.stats.dev,
    inode: file.stats.inode,
    size: file.stats.size,
    mtimeMs: Math.trunc(file.stats.mtimeMs),
    sha256,
    parsed: file.type === 'block' ? toCachedBlock(parsed as ParsedBlock) : toCachedView(parsed as ParsedView)
  };
}

function addParsedFile(
  parsed: ParsedBlock | ParsedView,
  blocks: ParsedBlock[],
  views: ParsedView[]
): void {
  if ('rawContent' in parsed) {
    blocks.push(parsed);
    return;
  }

  views.push(parsed);
}

function fromCacheEntry(entry: CacheIndexEntry): ParsedBlock | ParsedView {
  return entry.type === 'block'
    ? fromCachedBlock(entry.parsed as CachedBlock, entry)
    : fromCachedView(entry.parsed as CachedView, entry);
}

function fromCachedBlock(cached: CachedBlock, entry: CacheIndexEntry): ParsedBlock {
  return {
    id: cached.id,
    tags: [...cached.tags],
    dependsOn: cached.dependsOn.map((dependency) => ({ ...dependency })),
    sections: cached.sections.map((section) => ({
      name: section.name,
      prose: section.prose,
      tags: section.tags.map(fromCachedTag),
      externalTags: section.externalTags.map(fromCachedTag),
      position: ZERO_POSITION,
      proseRange: { startOffset: 0, endOffset: 0 }
    })),
    standaloneTags: cached.standaloneTags.map(fromCachedTag),
    filePath: entry.filePath,
    relativePath: entry.relativePath,
    rawContent: '',
    bodyStartLine: 1
  };
}

function fromCachedView(cached: CachedView, entry: CacheIndexEntry): ParsedView {
  return {
    id: cached.id,
    group: cached.group,
    blockRefs: cached.blockRefs.map((blockRef) => ({ ...blockRef, position: ZERO_POSITION })),
    filePath: entry.filePath,
    relativePath: entry.relativePath,
    localContent: '',
    bodyStartLine: 1
  };
}

function fromCachedTag(tag: CachedTag): ParsedBlock['standaloneTags'][number] {
  return {
    ...tag,
    position: ZERO_POSITION,
    contentRange: { startOffset: 0, endOffset: 0 }
  };
}

function toGraphSnapshot(graph: StemGraph): GraphSnapshot {
  return {
    version: GRAPH_SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    nodes: [...graph.nodes.values()].map((node) => ({
      ...node,
      tags: [...node.tags]
    })),
    edges: graph.edges.map((edge) => ({ ...edge })),
    blockUsedInViews: toArrayRecord(graph.blockUsedInViews),
    viewUsesBlocks: toArrayRecord(graph.viewUsesBlocks),
    blockDependsOn: Object.fromEntries(
      [...graph.blockDependsOn.entries()].map(([blockId, dependencies]) => [
        blockId,
        dependencies.map((dependency) => ({ ...dependency }))
      ])
    ),
    blockDependents: toArrayRecord(graph.blockDependents)
  };
}

function toArrayRecord(map: Map<string, string[]>): Record<string, string[]> {
  return Object.fromEntries([...map.entries()].map(([key, values]) => [key, [...values]]));
}
