export type { BlockParameter, BlockRefSyntax } from './types/ast.js';
export { buildGraph } from './graph/builder.js';
export type { ConfigResult, PortableStemConfig } from './config/portable.js';
export type { DependencyRef, ParsedBlock } from './types/block.js';
export { detectCycles, getOrphanedBlocks } from './graph/traverser.js';
export type {
  ExternalBlockEntry,
  ExternalRenameEntry,
  ExternalSnapshotState,
  ExternalStemGraph,
  GraphEdge,
  GraphNode,
  StemGraph
} from './types/graph.js';
export {
  getDefaultPortableConfig,
  normalizeStemConfig,
  parseConfigJson,
  STEM_CONFIG_DEFAULTS,
  STEM_CONFIG_FILE
} from './config/portable.js';
export type { GraphBuildIssue } from './graph/types.js';
export { isExternalStemGraphShape } from './types/graph.js';
export { parseBlockFile, parseViewFile } from './parser/index.js';
export type { ParsedView } from './types/view.js';
export type { Position } from './types/position.js';
export { renderViewMarkdown } from './renderer/index.js';
export type { StemConfig } from './types/config.js';
export type { TagSchema } from './types/schema.js';
export { validateGraph } from './validator/rules.js';
export { validateSchemas } from './validator/schema.js';
export type { ValidationIssue, ValidationResult } from './types/validation.js';
