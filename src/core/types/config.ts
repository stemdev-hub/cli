// TODO: Define raw and resolved project configuration shapes.
export interface StemConfig {
  version: string;
  blocksDir?: string;
  viewsDir?: string;
}

export interface ResolvedStemConfig {
  version: string;
  blocksDir: string;
  viewsDir: string;
  projectRoot: string;
  schemasDir: string;
  cacheDir: string;
}
