import type { BlockSyntax, Diagnostic, SourceDocument, SourceLocation, SyntaxNode, SyntaxTree } from '../parser/syntax.js';

/** Supplied tokens have identity only within this snapshot, never persisted meaning. */
export interface InstanceInput {
  readonly handle: object;
  /** Undefined means unavailable; an empty array means an available empty project. */
  readonly sources: readonly SourceDocument[] | undefined;
  /** Set false when supplied documents are only a known subset. Defaults to true. */
  readonly sourcesComplete?: boolean;
  readonly bindings?: readonly ({ readonly alias: string; readonly target: object }
    | { readonly alias: string; readonly unavailable: 'invalid-configuration' | 'unavailable-source' })[];
}

export interface BlockReference {
  readonly id: string;
  readonly qualifier?: string;
}

/** Adapters supply every configured target, after mapping file paths to source handles. */
export interface OutputScope {
  readonly targets: readonly ({ readonly kind: 'block'; readonly reference: BlockReference }
    | { readonly kind: 'file'; readonly sourceId: string })[];
  readonly complete: boolean;
}

export interface ProjectSnapshot {
  readonly instances: readonly InstanceInput[];
  readonly localInstance: object;
  readonly outputs?: OutputScope;
}

export interface AliasBinding {
  readonly alias: string;
  readonly target?: InstanceContext;
  readonly diagnostics: readonly Diagnostic[];
}

export interface InstanceContext {
  /** Fresh for every analysis, distinct from the supplied token. */
  readonly handle: object;
  readonly available: boolean;
  readonly sources: readonly AnalyzedSource[];
  readonly bindings: readonly AliasBinding[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface AnalyzedSource {
  readonly instance: InstanceContext;
  readonly tree: SyntaxTree;
  /** Preorder inventory, including nested and invalid definitions. */
  readonly definitions: readonly Definition[];
  readonly inclusions: readonly InclusionOccurrence[];
  /** Whole-source diagnostics; definition associations remain explicit below. */
  readonly diagnostics: readonly Diagnostic[];
  readonly referencesComplete: boolean;
}

/** This record is the temporary definition handle; its instance is part of identity. */
export interface Definition {
  readonly instance: InstanceContext;
  readonly source: AnalyzedSource;
  readonly syntax: BlockSyntax;
  readonly parent?: Definition;
  readonly children: readonly Definition[];
  readonly id?: string;
  /** Decoded first spelling, deduplicated by NFC equality, never inherited. */
  readonly tags: readonly string[];
  readonly classificationComplete: boolean;
  /** Directly owned diagnostics; descendants are collected at selection time. */
  readonly diagnostics: readonly Diagnostic[];
  readonly referencesComplete: boolean;
}

export type BlockResolution =
  | { readonly status: 'resolved'; readonly target: Definition; readonly diagnostics: readonly Diagnostic[] }
  | { readonly status: 'ambiguous'; readonly candidates: readonly Definition[]; readonly diagnostics: readonly Diagnostic[] }
  | { readonly status: 'not-found' | 'unavailable'; readonly diagnostics: readonly Diagnostic[] };

export interface InclusionOccurrence {
  readonly source: AnalyzedSource;
  readonly owner?: Definition;
  readonly syntax: Extract<SyntaxNode, { kind: 'include' }>;
  /** Lookup outcome only; selected-target diagnostics are collected by selection. */
  readonly resolution: BlockResolution;
}

export type GraphEdge =
  | { readonly kind: 'containment'; readonly from: Definition; readonly to: Definition }
  | { readonly kind: 'inclusion'; readonly occurrence: InclusionOccurrence };

export interface StemGraph {
  readonly instances: readonly InstanceContext[];
  readonly nodes: readonly Definition[];
  readonly edges: readonly GraphEdge[];
}

export interface GraphCycle {
  readonly path: readonly Definition[];
  readonly closingEdge: GraphEdge;
  readonly diagnostic: Diagnostic;
}

export interface OutputUsage {
  readonly applicable: boolean;
  readonly complete: boolean;
  readonly blocks: readonly Definition[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface ProjectAnalysis {
  /** Preserves snapshot instance order so adapters can associate their input contexts. */
  readonly instances: readonly InstanceContext[];
  readonly localInstance?: InstanceContext;
  readonly graph: StemGraph;
  readonly diagnostics: readonly Diagnostic[];
  readonly outputUsage: OutputUsage;
}

export type AnalysisScope = Pick<ProjectAnalysis, 'instances'>;

/** Internal helpers, not package exports. Only pass records owned by this evaluation. */
export function freezeOwned<T extends object>(value: T): T {
  const pending: object[] = [value];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const record = pending.pop()!;
    if (seen.has(record) || Object.isFrozen(record)) continue;
    seen.add(record);
    for (const child of Object.values(record) as unknown[]) {
      if (child !== null && typeof child === 'object') pending.push(child);
    }
    Object.freeze(record);
  }
  return value;
}

export function definitionLocation(definition: Definition): SourceLocation {
  return { sourceId: definition.source.tree.source.sourceId,
    range: definition.syntax.header.range, instance: definition.instance.handle };
}

export function issue(code: string, message: string, location?: SourceLocation,
  related?: readonly SourceLocation[], severity: 'error' | 'warning' = 'error'): Diagnostic {
  return { code, message, severity, ...(location ? { location } : {}), ...(related ? { related } : {}) };
}

export function subtreeDiagnostics(roots: readonly Definition[]): Diagnostic[] {
  const diagnostics = new Set<Diagnostic>();
  const seen = new Set<Definition>();
  const pending = [...roots].reverse();
  while (pending.length > 0) {
    const definition = pending.pop()!;
    if (seen.has(definition)) continue;
    seen.add(definition);
    for (const diagnostic of definition.diagnostics) diagnostics.add(diagnostic);
    for (let i = definition.children.length - 1; i >= 0; i--) pending.push(definition.children[i]!);
  }
  return [...diagnostics];
}
