export interface NamespaceConfig {
  readonly graphUrl?: string;
  readonly localPath?: string;
}
export interface StemConfig {
  readonly projectId: string;
  readonly namespace?: string;
  readonly publishUrl?: string;
  readonly blocksDir?: string;
  readonly cacheDir?: string;
  readonly namespaces?: Readonly<Record<string, NamespaceConfig>>;
  readonly outputSets?: Readonly<Record<string, OutputSetConfig>>;
}

export type ConfigErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_READ_FAILED'
  | 'CONFIG_INVALID_JSON'
  | 'CONFIG_INVALID_SCHEMA'
  | 'CONFIG_INVALID_PATH';

export interface ConfigError {
  code: ConfigErrorCode;
  message: string;
  path: string;
}

/** Explicit adapter-facing selectors; neither spelling nor Tags imply a selector kind. */
export type OutputSource =
  | { readonly kind: 'block'; readonly ref: string }
  | { readonly kind: 'file'; readonly path: string };

export interface OutputTarget {
  readonly source: OutputSource;
  /** Canonical slash-separated file path relative to this set's output directory. */
  readonly path: string;
}

/** Authored policies may be omitted; normalized OutputSet carries effective values. */
export interface OutputSetConfig {
  readonly outputDir?: string;
  readonly ifExists?: 'replace' | 'skip' | 'error';
  readonly cleanup?: 'keep' | 'prune';
  readonly targets: readonly OutputTarget[];
}
export interface OutputSet {
  /** Original spelling; the adapter resolves this against the configuring project. */
  readonly outputDir: string;
  readonly ifExists: 'replace' | 'skip' | 'error';
  readonly cleanup: 'keep' | 'prune';
  readonly targets: readonly OutputTarget[];
}

/** Own set names only, including names such as __proto__; no inherited dictionary entries. */
export type OutputSets = Readonly<Record<string, OutputSet>>;
