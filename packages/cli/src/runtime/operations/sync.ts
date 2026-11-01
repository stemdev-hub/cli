import { createHash } from 'node:crypto';
import type {
  GraphSnapshot,
  CacheIndexEntry,
  OperationResult,
  ProjectOperationOptions,
  SyncResult
} from '../types/index.js';
import { loadProjectGraph } from './project.js';
import { readFileStats } from '../fs/reader.js';
import { writeCacheIndex, CACHE_VERSION } from '../cache/index-store.js';
import { writeGraphSnapshot, GRAPH_SNAPSHOT_VERSION } from '../cache/graph-store.js';
import { fromFsError, fromCacheError } from './errors.js';
export async function syncProject(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<SyncResult>> {
  const start = Date.now();
  const loaded = await loadProjectGraph(options);
  if (!loaded.success) return loaded;
  const project = loaded.data;
  const entries: Record<string, CacheIndexEntry> = Object.create(null) as Record<
    string,
    CacheIndexEntry
  >;
  for (const file of project.files) {
    const stats = await readFileStats(file.filePath);
    if (!stats.success) return { success: false, error: fromFsError(stats.error) };
    entries[file.relativePath] = {
      ...stats.data,
      relativePath: file.relativePath,
      sha256: createHash('sha256')
        .update(project.sources.find((s) => s.sourceId === file.relativePath)!.content)
        .digest('hex')
    };
  }
  const graph = project.analysis.graph;
  const indices = new Map(graph.nodes.map((node, index) => [node, index]));
  const snapshot: GraphSnapshot = {
    version: GRAPH_SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    nodes: graph.nodes.map((node) => ({
      source: node.source.tree.source.sourceId,
      ...(node.id === undefined ? {} : { id: node.id }),
      tags: [...node.tags]
    })),
    edges: graph.edges.map((edge) =>
      edge.kind === 'containment'
        ? { kind: edge.kind, from: indices.get(edge.from)!, to: indices.get(edge.to)! }
        : {
            kind: edge.kind,
            source: edge.occurrence.source.tree.source.sourceId,
            ...(edge.occurrence.owner ? { from: indices.get(edge.occurrence.owner)! } : {}),
            ...(edge.occurrence.resolution.status === 'resolved'
              ? { to: indices.get(edge.occurrence.resolution.target)! }
              : {}),
            reference:
              (edge.occurrence.syntax.target.qualifier
                ? edge.occurrence.syntax.target.qualifier + ':'
                : '') + edge.occurrence.syntax.target.id,
            status: edge.occurrence.resolution.status
          }
    )
  };
  const indexWrite = await writeCacheIndex(project.projectRoot, project.config, {
    version: CACHE_VERSION,
    entries
  });
  if (!indexWrite.success) return { success: false, error: fromCacheError(indexWrite.error) };
  const graphWrite = await writeGraphSnapshot(project.projectRoot, project.config, snapshot);
  if (!graphWrite.success) return { success: false, error: fromCacheError(graphWrite.error) };
  return {
    success: true,
    data: {
      scannedFiles: project.files.length,
      parsedFiles: project.files.length,
      graphNodes: graph.nodes.length,
      graphEdges: graph.edges.length,
      durationMs: Date.now() - start
    }
  };
}
