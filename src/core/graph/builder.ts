import type { ParsedBlock, ParsedView, StemGraph } from '@stem/types';

// TODO: Build an in-memory dynamic graph from parsed blocks and views.
export function buildGraph(files: Array<ParsedBlock | ParsedView>): StemGraph {
  void files;
  throw new Error('TODO: implement dynamic graph construction.');
}
