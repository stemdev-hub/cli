import type { ResolvedStemConfig } from '@stem/types';

// TODO: Locate Stem project roots and scan block/view files without parsing them.
export async function findProjectRoot(startDir: string = process.cwd()): Promise<string> {
  void startDir;
  throw new Error('TODO: implement project root discovery.');
}

export async function scanStemFiles(
  _config: ResolvedStemConfig
): Promise<{ blocks: string[]; views: string[] }> {
  throw new Error('TODO: implement block and view file scanning.');
}
