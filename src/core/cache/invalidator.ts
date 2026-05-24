import type { CacheIndexEntry } from '@stem/types';

// TODO: Compare stat metadata first, then SHA when mtime or size indicates possible change.
export function invalidateCache(
  cached: CacheIndexEntry | null,
  current: Pick<CacheIndexEntry, 'dev' | 'inode' | 'size' | 'mtimeMs'>
): 'hit' | 'hash-required' | 'miss' {
  void cached;
  void current;
  throw new Error('TODO: implement hybrid stat plus SHA invalidation.');
}
