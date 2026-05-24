// TODO: Re-export all shared types from one type-only barrel.
export type { Point, Position } from './position.js';
export type {
  StemASTNode,
  StemTagNode,
  StemSectionNode,
  StemBlockRefNode,
  StemDepNode
} from './ast.js';
export type { StemConfig, ResolvedStemConfig } from './config.js';
export type { TagSchema } from './schema.js';
export type {
  DependencyRef,
  CachedTag,
  CachedSection,
  CachedBlock,
  StemTag,
  StemSection,
  ParsedBlock
} from './block.js';
export type { CachedBlockRef, CachedView, BlockRef, ParsedView } from './view.js';
export type { NodeType, GraphNode, EdgeType, GraphEdge, StemGraph } from './graph.js';
export type { CacheIndexEntry, CacheIndex, GraphSnapshot } from './cache.js';
export type {
  IssueSeverity,
  IssueContextMap,
  ValidationIssue,
  ValidationResult
} from './validation.js';
export type {
  InitResult,
  CreateBlockResult,
  CreateViewResult,
  CreateGroupResult,
  DeleteResult,
  RenameResult,
  AddRefResult,
  SyncResult,
  CheckResult,
  ListBlocksResult,
  ListViewsResult
} from './operations.js';
