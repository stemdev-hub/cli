import type { StemGraph } from '@stem/types';

export interface GraphBuildResult {
  graph: StemGraph;
  issues: GraphBuildIssue[];
}

export interface GraphBuildIssue {
  code: 'DUPLICATE_BLOCK_ID' | 'DUPLICATE_VIEW_ID';
  id: string;
  conflictingPaths: string[];
}
