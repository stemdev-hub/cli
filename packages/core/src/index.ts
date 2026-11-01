export { parse } from './parser/scanner.js';
export { isBlockId, parseBlockReference } from './parser/grammar.js';
export type * from './parser/syntax.js';
export { analyzeProject } from './project/analysis.js';
export { resolveBlockReference, findBlocksByTag } from './project/selection.js';
export type {
  InstanceInput,
  BlockReference,
  OutputScope,
  ProjectSnapshot,
  AliasBinding,
  InstanceContext,
  AnalyzedSource,
  Definition,
  BlockResolution,
  InclusionOccurrence,
  GraphEdge,
  StemGraph,
  GraphCycle,
  OutputUsage,
  ProjectAnalysis,
  AnalysisScope
} from './project/model.js';
export { buildGraph, detectCycles, validateGraph, getOrphanedBlocks } from './graph/analysis.js';
export { compose, DEFAULT_COMPOSITION_LIMITS } from './renderer/compose.js';
export type {
  CompositionTarget,
  CompositionLimits,
  CompositionResult
} from './renderer/compose.js';
export {
  planCreateBlock,
  planAddInclusion,
  planDeleteBlock,
  planRenameBlock
} from './project/editing.js';
export type { EditDestination, SourceEdit, SourceEditPlan } from './project/editing.js';
export {
  normalizeStemConfig,
  parseConfigJson,
  STEM_CONFIG_DEFAULTS,
  STEM_CONFIG_FILE
} from './config/portable.js';
export type { ConfigResult, PortableStemConfig } from './config/portable.js';
export type { StemConfig, NamespaceConfig } from './types/config.js';
export type {
  OutputSource,
  OutputTarget,
  OutputSet,
  OutputSetConfig,
  OutputSets
} from './config/outputs.js';
export { decodeExternalSnapshotEnvelope, projectExternalBlocks } from './project/external.js';
export { isExternalStemGraphShape } from './types/graph.js';
export type {
  ExternalBlockEntry,
  ExternalRenameEntry,
  ExternalSnapshotState,
  ExternalStemGraph
} from './types/graph.js';
export { validateExternalReferences } from './validator/rules.js';
export type { ExternalValidationOptions } from './validator/rules.js';
