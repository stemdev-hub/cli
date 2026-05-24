import type { GraphSnapshot } from '@stem/types';

// TODO: Read and write /.stem/cache/graph.json snapshots only.
export async function readGraphSnapshot(cacheDir: string): Promise<GraphSnapshot | null> {
  void cacheDir;
  throw new Error('TODO: implement graph snapshot reads.');
}

export async function writeGraphSnapshot(cacheDir: string, snapshot: GraphSnapshot): Promise<void> {
  void cacheDir;
  void snapshot;
  throw new Error('TODO: implement graph snapshot writes.');
}
