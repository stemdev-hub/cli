export interface FileStats {
  filePath: string;
  size: number;
  mtimeMs: number;
  dev: string;
  inode: string;
}
export interface CacheIndexEntry extends FileStats {
  readonly relativePath: string;
  readonly sha256: string;
}
export interface CacheIndex {
  readonly version: string;
  readonly entries: Readonly<Record<string, CacheIndexEntry>>;
}
export interface DiscoveredFile {
  readonly filePath: string;
  readonly relativePath: string;
}
/** Ordinals identify records only within this persisted snapshot; they are not analysis handles. */
export interface GraphSnapshot {
  readonly version: string;
  readonly generatedAt: string;
  readonly nodes: readonly {
    readonly source: string;
    readonly id?: string;
    readonly tags: readonly string[];
  }[];
  readonly edges: readonly {
    readonly kind: 'containment' | 'inclusion';
    readonly from?: number;
    readonly to?: number;
    readonly source?: string;
    readonly reference?: string;
    readonly status?: string;
  }[];
}
