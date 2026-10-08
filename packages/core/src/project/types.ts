import type { ParsedBlock } from '../types/block.js';
import type { NamespaceConfig } from '../types/config.js';
import type { ExternalSnapshotState, StemGraph } from '../types/graph.js';
import type { TagSchema } from '../types/schema.js';
import type { ValidationResult } from '../types/validation.js';
import type { ParsedView } from '../types/view.js';

export interface SourceDocument {
  content: string;
  filePath: string;
  relativePath: string;
}

export interface ProjectSnapshot {
  blocks: SourceDocument[];
  views: SourceDocument[];
  schemas: Map<string, TagSchema>;
  configuredNamespaces: Record<string, NamespaceConfig>;
  externalGraphs: Map<string, ExternalSnapshotState>;
}

export interface AnalysisOptions {
  nowMs: number;
  strictExternal?: boolean;
}

export interface ProjectAnalysis {
  blocks: ParsedBlock[];
  views: ParsedView[];
  graph: StemGraph;
  validation: ValidationResult;
}
