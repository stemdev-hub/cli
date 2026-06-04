import type { CachedBlock, DependencyRef } from './block.js';
import type { GraphEdge, GraphNode } from './graph.js';
import type { CachedView } from './view.js';

// Filesystem stats normalized for cross-platform cache invalidation.
// Lives here because these stats exist primarily for cache invalidation.
export interface FileStats {
  filePath: string;
  size: number;
  mtimeMs: number;
  dev: string;
  inode: string;
}

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

export interface DiscoveredFile {
  filePath: string;
  relativePath: string;
  type: 'block' | 'view';
}

// A single file's invalidation classification result.
export interface FileInvalidation {
  filePath: string;
  relativePath: string;
  type: 'block' | 'view';
  stats: FileStats;
  sha256?: string;
  cached?: CacheIndexEntry;
}

// Full result of running cache invalidation against a set of discovered files.
export interface CacheInvalidationResult {
  added: FileInvalidation[];
  changed: FileInvalidation[];
  unchanged: FileInvalidation[];
  metadataChanged: FileInvalidation[];
  deleted: CacheIndexEntry[];
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
