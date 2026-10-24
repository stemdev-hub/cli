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
  cacheDir?: string;
  namespaces?: Record<string, NamespaceConfig>;
}
