import type {
  CompositionLimits,
  CompositionResult,
  Diagnostic,
  OutputSource,
  OutputSets,
  SourceRange
} from '@stemdev/core';
import type { PublicationTarget } from '../output/publication.js';
import type { CleanupOutcome, OutputFailure } from '../output/cleanup.js';
export type OperationErrorCode =
  | 'PROJECT_ROOT_NOT_FOUND'
  | 'CONFIG_ERROR'
  | 'FS_ERROR'
  | 'CACHE_ERROR'
  | 'INVALID_OPERATION'
  | 'CONFLICT'
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR';
export interface OperationError {
  readonly code: OperationErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly cause?: unknown;
}
export type OperationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: OperationError };
export interface ProjectOperationOptions {
  readonly startDir?: string;
  readonly strictExternal?: boolean;
  readonly useRemote?: boolean;
}
export interface InitProjectOptions extends ProjectOperationOptions {
  readonly force?: boolean;
}
export interface InitResult {
  readonly projectRoot: string;
  readonly blocksDir: string;
}
export type AuthoringDestination =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'block'; readonly id: string };
export interface CreateBlockOptions extends ProjectOperationOptions {
  readonly destination: AuthoringDestination;
  readonly tags?: readonly string[];
}
export interface AddInclusionOptions extends ProjectOperationOptions {
  readonly destination: AuthoringDestination;
}
export interface DeleteOptions extends ProjectOperationOptions {
  readonly force?: boolean;
}
export interface MutationResult {
  readonly success: boolean;
  readonly changedFiles: readonly string[];
  readonly affectedReferences: number;
  readonly diagnostics: readonly Diagnostic[];
  readonly error?: OperationError;
  readonly stage?: 'preparation' | 'revalidation' | 'source' | 'configuration' | 'history';
}
export interface ListBlocksOptions extends ProjectOperationOptions {
  readonly tag?: string;
}
export interface BlockRow {
  readonly sourceId: string;
  readonly range: SourceRange;
  readonly id?: string;
  readonly tags: readonly string[];
}
export interface ListBlocksResult {
  readonly blocks: readonly BlockRow[];
  readonly total: number;
  readonly classificationComplete: boolean;
  readonly diagnostics: readonly Diagnostic[];
}
export interface ReferenceRow {
  readonly sourceId: string;
  readonly range: SourceRange;
  readonly owner?: BlockRow;
}
export interface ListReferencesResult {
  readonly references: readonly ReferenceRow[];
  readonly total: number;
  readonly complete: boolean;
  readonly diagnostics: readonly Diagnostic[];
}
export interface ListOutputsResult {
  readonly outputSets: OutputSets;
}
export interface CheckResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly errors: number;
  readonly warnings: number;
  readonly valid: boolean;
  readonly scannedFiles: number;
  readonly durationMs: number;
}
export interface SyncResult {
  readonly scannedFiles: number;
  readonly parsedFiles: number;
  readonly graphNodes: number;
  readonly graphEdges: number;
  readonly durationMs: number;
}
export interface PreviewOptions extends ProjectOperationOptions {
  readonly limits?: CompositionLimits;
}
export type PreviewResult = CompositionResult;
export type SourceSelector = OutputSource;
export type OutputSelection =
  | { readonly kind: 'all' }
  | {
      readonly kind: 'sets';
      readonly sets: readonly { readonly name: string; readonly targets?: readonly string[] }[];
    };
export interface RenderResult {
  readonly success: boolean;
  readonly targets: readonly (PublicationTarget & {
    readonly diagnostics: readonly Diagnostic[];
  })[];
  readonly cleanup: readonly CleanupOutcome[];
  readonly errors: readonly OutputFailure[];
}
export interface CleanupOptions extends ProjectOperationOptions {
  readonly outputDir: string;
  readonly set: string;
  readonly apply?: boolean;
}
export interface FetchNamespacesResult {
  readonly successes: readonly string[];
  readonly skipped: readonly string[];
  readonly warnings: readonly string[];
}
export interface PublishGraphResult {
  readonly namespace: string;
  readonly uploadedTo: string;
}
