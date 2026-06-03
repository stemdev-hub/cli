// Complete Stem type reference.
//
// This document is the human-readable reference for the live type mirrors in
// src/core/types. Keep comments here explanatory; keep implementation files
// small and importable.

// position.ts
export interface Point {
  // 1-indexed source line.
  line: number;
  // 1-indexed source column.
  column: number;
  // Optional per unist; synthetic nodes may not have offsets.
  offset?: number;
}

export interface Position {
  start: Point;
  end: Point;
  // Optional per unist; used by multiline node stringifiers.
  indent?: number[];
}

// ast.ts
export interface StemASTNode {
  type: string;
  data?: Record<string, unknown>;
  position?: Position;
}

export interface StemTagNode extends StemASTNode {
  type: 'stemTag';
  name: string;
  section: string | null;
  content: string;
}

export interface StemSectionNode extends StemASTNode {
  type: 'stemSection';
  name: string;
  prose: string;
}

export interface StemBlockRefNode extends StemASTNode {
  type: 'stemBlockRef';
  blockId: string;
  section: string | null;
  tag: string | null;
  raw: string;
}

export interface StemDepNode extends StemASTNode {
  type: 'stemDep';
  blockId: string;
  section: string | null;
  tag: string | null;
  raw: string;
}

// config.ts
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

// schema.ts
export interface TagSchema {
  name: string;
  required: string[];
  description?: string;
}

// block.ts
export interface DependencyRef {
  blockId: string;
  section: string | null;
  tag: string | null;
  raw: string;
}

export interface CachedTag {
  name: string;
  section: string | null;
  content: string;
}

export interface CachedSection {
  name: string;
  tags: CachedTag[];
  externalTags: CachedTag[];
  prose: string;
}

export interface CachedBlock {
  id: string;
  tags: string[];
  dependsOn: DependencyRef[];
  sections: CachedSection[];
  standaloneTags: CachedTag[];
}

export interface StemTag extends CachedTag {
  position: Position;
}

export interface StemSection extends Omit<CachedSection, 'tags' | 'externalTags'> {
  tags: StemTag[];
  externalTags: StemTag[];
  position: Position;
}

export interface ParsedBlock extends Omit<CachedBlock, 'sections' | 'standaloneTags'> {
  sections: StemSection[];
  standaloneTags: StemTag[];
  filePath: string;
  relativePath: string;
  rawContent: string;
}

// view.ts
export interface CachedBlockRef {
  blockId: string;
  section: string | null;
  tag: string | null;
  raw: string;
}

export interface CachedView {
  id: string;
  group: string | null;
  blockRefs: CachedBlockRef[];
}

export interface BlockRef extends CachedBlockRef {
  position: Position;
}

export interface ParsedView extends Omit<CachedView, 'blockRefs'> {
  blockRefs: BlockRef[];
  filePath: string;
  relativePath: string;
  localContent: string;
}

// graph.ts
export type NodeType = 'block' | 'view';
export type EdgeType = 'view-uses-block' | 'block-depends-on';

export interface GraphNode {
  id: string;
  type: NodeType;
  filePath: string;
  relativePath: string;
  tags: string[];
  group: string | null;
}

export interface GraphEdge {
  type: EdgeType;
  from: string;
  to: string;
  section: string | null;
  tag: string | null;
}

export interface StemGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  blockUsedInViews: Map<string, string[]>;
  viewUsesBlocks: Map<string, string[]>;
  blockDependsOn: Map<string, DependencyRef[]>;
  blockDependents: Map<string, string[]>;
}

// cache.ts
export interface CacheIndexEntry {
  filePath: string;
  relativePath: string;
  type: 'block' | 'view';
  // Stringified BigInt device ID from fs.stat({ bigint: true }).
  // Device is stored because inode values are unique only per device.
  dev: string;
  // Stringified BigInt inode. Never store this as Number; 64-bit inode values
  // can exceed JavaScript's safe integer range.
  inode: string;
  size: number;
  // Store Math.trunc(stats.mtimeMs) to avoid floating-point filesystem drift.
  mtimeMs: number;
  sha256: string;
  parsed: CachedBlock | CachedView;
}

export interface CacheIndex {
  version: string;
  entries: Record<string, CacheIndexEntry>;
}

export interface GraphSnapshot {
  version: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  blockUsedInViews: Record<string, string[]>;
  viewUsesBlocks: Record<string, string[]>;
  blockDependsOn: Record<string, DependencyRef[]>;
  blockDependents: Record<string, string[]>;
}

// validation.ts
export type IssueSeverity = 'error' | 'warning';

export interface IssueContextMap {
  DUPLICATE_ID: { id: string; collidingFilePath: string };
  BROKEN_BLOCK_REF: { targetId: string; rawRef: string };
  BROKEN_SECTION_REF: { targetId: string; targetSection: string };
  EXTERNAL_TAG_MISSING_SECTION: { tagName: string; sectionName: string };
  CROSS_BLOCK_SECTION_REF: { sourceBlockId: string; targetBlockId: string };
  CIRCULAR_DEPENDENCY: { dependencyChain: string };
  SCHEMA_VIOLATION: { tagName: string; missingSections: string };
  ORPHANED_BLOCK: { blockId: string };
  DUPLICATE_TAG_IN_SECTION: { tagName: string; sectionName: string };
  UNRESOLVED_TAG: { targetId: string; targetSection: string; missingTag: string };
  INVALID_FRONTMATTER: { parseError: string };
}

export type ValidationIssue = {
  [K in keyof IssueContextMap]: Readonly<{
    code: K;
    severity: IssueSeverity;
    message: string;
    filePath: string;
    relativePath: string;
    position?: Position;
    context: IssueContextMap[K];
  }>;
}[keyof IssueContextMap];

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

// operations.ts
export interface InitResult {
  projectRoot: string;
  blocksDir: string;
  viewsDir: string;
  schemasDir: string;
}

export interface CreateBlockResult {
  id: string;
  filePath: string;
  relativePath: string;
  scaffolded: boolean;
  scaffoldedTag: string | null;
}

export interface CreateViewResult {
  id: string;
  filePath: string;
  relativePath: string;
  group: string | null;
}

export interface CreateGroupResult {
  groupPath: string;
  absolutePath: string;
}

export interface DeleteResult {
  id: string;
  filePath: string;
  relativePath: string;
  referencingIds: string[];
  forced: boolean;
}

export interface RenameResult {
  oldId: string;
  newId: string;
  blockFilePath: string;
  updatedFiles: string[];
  updatedRefCount: number;
}

export interface AddRefResult {
  blockId: string;
  viewId: string;
  viewFilePath: string;
  section: string | null;
  tag: string | null;
  refString: string;
}

export interface SyncResult {
  scannedFiles: number;
  parsedFiles: number;
  cachedFiles: number;
  graphNodes: number;
  graphEdges: number;
  durationMs: number;
}

export interface CheckResult {
  validation: ValidationResult;
  scannedFiles: number;
  durationMs: number;
}

export interface ListBlocksResult {
  blocks: Array<{
    id: string;
    tags: string[];
    relativePath: string;
    usedInViews: string[];
    sectionCount: number;
    standaloneTagCount: number;
  }>;
  total: number;
}

export interface ListViewsResult {
  views: Array<{
    id: string;
    group: string | null;
    relativePath: string;
    blockCount: number;
    blockIds: string[];
  }>;
  total: number;
}
