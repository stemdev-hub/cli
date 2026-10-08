import type { DependencyRef } from './block.js';

export type NodeType = 'block' | 'view';

export interface GraphNode {
  id: string;
  type: NodeType;
  filePath: string;
  relativePath: string;
  tags: string[];
  group: string | null;
}

export type EdgeType = 'view-uses-block' | 'block-depends-on';

export interface GraphEdge {
  type: EdgeType;
  from: string;
  to: string;
  section: string | null;
  tag: string | null;
}

export interface StemGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  blockUsedInViews: Map<string, string[]>;
  viewUsesBlocks: Map<string, string[]>;
  blockDependsOn: Map<string, DependencyRef[]>;
  blockDependents: Map<string, string[]>;
}

export interface ExternalBlockEntry {
  id: string;
  tags: string[];
  sections: Array<{ id: string; tags: string[] }>;
}

export interface ExternalRenameEntry {
  from: string;
  to: string;
  since: string;
}

export interface ExternalStemGraph {
  version: string;
  namespace: string;
  publishedAt: string;
  contentSha: string;
  blocks: ExternalBlockEntry[];
  renames: ExternalRenameEntry[];
}

export interface ExternalSnapshotState {
  graph: ExternalStemGraph;
  fetchedAt: string;
  isLocalFallback: boolean;
}

export function isExternalStemGraphShape(value: unknown): value is ExternalStemGraph {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  
  const obj = value as Record<string, unknown>;
  
  if (
    typeof obj['version'] !== 'string' ||
    typeof obj['namespace'] !== 'string' ||
    typeof obj['publishedAt'] !== 'string' ||
    typeof obj['contentSha'] !== 'string' ||
    !Array.isArray(obj['blocks']) ||
    !Array.isArray(obj['renames'])
  ) {
    return false;
  }

  const blocksValid = obj['blocks'].every((block: unknown) => {
    if (typeof block !== 'object' || block === null || Array.isArray(block)) return false;
    const b = block as Record<string, unknown>;
    if (typeof b['id'] !== 'string') return false;
    if (!Array.isArray(b['tags']) || !b['tags'].every((t) => typeof t === 'string')) return false;
    if (!Array.isArray(b['sections'])) return false;
    
    return b['sections'].every((sec: unknown) => {
      if (typeof sec !== 'object' || sec === null || Array.isArray(sec)) return false;
      const s = sec as Record<string, unknown>;
      return typeof s['id'] === 'string' && Array.isArray(s['tags']) && s['tags'].every((t) => typeof t === 'string');
    });
  });

  if (!blocksValid) return false;

  const renamesValid = obj['renames'].every((rename: unknown) => {
    if (typeof rename !== 'object' || rename === null || Array.isArray(rename)) return false;
    const r = rename as Record<string, unknown>;
    return typeof r['from'] === 'string' && typeof r['to'] === 'string' && typeof r['since'] === 'string';
  });

  return renamesValid;
}
