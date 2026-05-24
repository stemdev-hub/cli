import type { CacheIndexEntry } from '@stem/types';

// TODO: Read Markdown files and bigint filesystem stats for cache comparison.
export async function readStemFile(
  filePath: string
): Promise<{ filePath: string; content: string; stat: Pick<CacheIndexEntry, 'dev' | 'inode' | 'size' | 'mtimeMs'> }> {
  void filePath;
  throw new Error('TODO: implement Stem file reads.');
}
