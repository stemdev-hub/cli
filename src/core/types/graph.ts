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
