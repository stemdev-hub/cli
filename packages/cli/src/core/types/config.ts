export interface NamespaceConfig {
  graphUrl?: string;
  localPath?: string;
}

export interface StemConfig {
  version?: string;
  namespace?: string;
  publishUrl?: string;
  blocksDir?: string;
  viewsDir?: string;
  schemasDir?: string;
  cacheDir?: string;
  namespaces?: Record<string, NamespaceConfig>;
}

export interface ResolvedStemConfig {
  version: string;
  namespace?: string;
  publishUrl?: string;
  projectRoot: string;
  blocksDir: string;
  viewsDir: string;
  schemasDir: string;
  cacheDir: string;
  namespaces: Record<string, NamespaceConfig>;
}
