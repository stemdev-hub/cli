import type { StemGraph } from '../types/index.js';

export interface GraphBuildResult {
  graph: StemGraph;
  issues: GraphBuildIssue[];
}

export interface GraphBuildIssue {
  code: 'DUPLICATE_BLOCK_ID' | 'DUPLICATE_VIEW_ID';
  id: string;
  conflictingPaths: string[];
}
