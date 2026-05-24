import type { CacheIndex } from '@stem/types';

// TODO: Read and write /.stem/cache/index.json without deriving graph data.
export async function readCacheIndex(cacheDir: string): Promise<CacheIndex | null> {
  void cacheDir;
  throw new Error('TODO: implement cache index reads.');
}

export async function writeCacheIndex(cacheDir: string, index: CacheIndex): Promise<void> {
  void cacheDir;
  void index;
  throw new Error('TODO: implement cache index writes.');
}
