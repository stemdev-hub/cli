import type { CachedBlock, DependencyRef } from './block.js';
import type { GraphEdge, GraphNode } from './graph.js';
import type { CachedView } from './view.js';

// TODO: Define serializable cache records for hybrid stat plus SHA invalidation.
export interface CacheIndexEntry {
  filePath: string;
  relativePath: string;
  type: 'block' | 'view';
  dev: string;
  inode: string;
  size: number;
  mtimeMs: number;
  sha256: string;
  parsed: CachedBlock | CachedView;
}

export interface CacheIndex {
  version: string;
  entries: Record<string, CacheIndexEntry>;
}

export interface GraphSnapshot {
  version: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  blockUsedInViews: Record<string, string[]>;
  viewUsesBlocks: Record<string, string[]>;
  blockDependsOn: Record<string, DependencyRef[]>;
  blockDependents: Record<string, string[]>;
}
