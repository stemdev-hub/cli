export interface StemConfig {
  version?: string;
  blocksDir?: string;
  viewsDir?: string;
  schemasDir?: string;
  cacheDir?: string;
}

export interface ResolvedStemConfig {
  version: string;
  projectRoot: string;
  blocksDir: string;
  viewsDir: string;
  schemasDir: string;
  cacheDir: string;
}
