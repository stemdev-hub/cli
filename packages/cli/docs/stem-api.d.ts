import { CompositionLimits } from '@stemdev/core';
import { CompositionResult } from '@stemdev/core';
import { ConfigResult } from '@stemdev/core';
import { Diagnostic } from '@stemdev/core';
import { OutputSets } from '@stemdev/core';
import { OutputSource } from '@stemdev/core';
import { PortableStemConfig } from '@stemdev/core';
import { SourceRange } from '@stemdev/core';
import { StemConfig } from '@stemdev/core';

export declare function addInclusion(reference: string, options: AddInclusionOptions): Promise<MutationResult>;

export declare interface AddInclusionOptions extends ProjectOperationOptions {
    readonly destination: AuthoringDestination;
}

export declare type AuthoringDestination = {
    readonly kind: 'file';
    readonly path: string;
} | {
    readonly kind: 'block';
    readonly id: string;
};

export declare interface BlockRow {
    readonly sourceId: string;
    readonly range: SourceRange;
    readonly id?: string;
    readonly tags: readonly string[];
}

export declare interface CacheIndex {
    readonly version: string;
    readonly entries: Readonly<Record<string, CacheIndexEntry>>;
}

export declare interface CacheIndexEntry extends FileStats {
    readonly relativePath: string;
    readonly sha256: string;
}

export declare function checkProject(options?: ProjectOperationOptions): Promise<OperationResult<CheckResult>>;

export declare interface CheckResult {
    readonly diagnostics: readonly Diagnostic[];
    readonly errors: number;
    readonly warnings: number;
    readonly valid: boolean;
    readonly scannedFiles: number;
    readonly durationMs: number;
}

export declare interface CleanupOptions extends ProjectOperationOptions {
    readonly outputDir: string;
    readonly set: string;
    readonly apply?: boolean;
}

export declare interface CleanupOutcome {
    readonly root: string;
    readonly outputSet: string;
    readonly path?: string;
    readonly action: 'retained' | 'eligible' | 'absent' | 'deleted' | 'record-removed' | 'suppressed' | 'unavailable';
    readonly reason?: string;
    /** Only present for applied changes; false preserves evidence of failed persistence. */
    readonly tracked?: boolean;
}

/** Assess by default; apply only explicitly, under the current producer's identity. */
export declare function cleanupOutputs(options: CleanupOptions): Promise<CleanupResult>;

export declare interface CleanupResult {
    readonly success: boolean;
    readonly outcomes: readonly CleanupOutcome[];
    readonly errors: readonly OutputFailure[];
}

export declare function createBlock(id: string, options: CreateBlockOptions): Promise<MutationResult>;

export declare interface CreateBlockOptions extends ProjectOperationOptions {
    readonly destination: AuthoringDestination;
    readonly tags?: readonly string[];
}

export declare function deleteBlock(id: string, options?: DeleteOptions): Promise<MutationResult>;

export declare interface DeleteOptions extends ProjectOperationOptions {
    readonly force?: boolean;
}

export declare interface DiscoveredFile {
    readonly filePath: string;
    readonly relativePath: string;
}

export declare interface FetchNamespacesResult {
    readonly successes: readonly string[];
    readonly skipped: readonly string[];
    readonly warnings: readonly string[];
}

export declare interface FileStats {
    filePath: string;
    size: number;
    mtimeMs: number;
    dev: string;
    inode: string;
}

/** Ordinals identify records only within this persisted snapshot; they are not analysis handles. */
export declare interface GraphSnapshot {
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

export declare function initProject(options?: InitProjectOptions): Promise<OperationResult<InitResult>>;

export declare interface InitProjectOptions extends ProjectOperationOptions {
    readonly force?: boolean;
}

export declare interface InitResult {
    readonly projectRoot: string;
    readonly blocksDir: string;
}

export declare function listBlocks(options?: ListBlocksOptions): Promise<OperationResult<ListBlocksResult>>;

export declare interface ListBlocksOptions extends ProjectOperationOptions {
    readonly tag?: string;
}

export declare interface ListBlocksResult {
    readonly blocks: readonly BlockRow[];
    readonly total: number;
    readonly classificationComplete: boolean;
    readonly diagnostics: readonly Diagnostic[];
}

export declare function listOutputs(options?: ProjectOperationOptions): Promise<OperationResult<ListOutputsResult>>;

export declare interface ListOutputsResult {
    readonly outputSets: OutputSets;
}

export declare function listReferences(id: string, options?: ProjectOperationOptions): Promise<OperationResult<ListReferencesResult>>;

export declare interface ListReferencesResult {
    readonly references: readonly ReferenceRow[];
    readonly total: number;
    readonly complete: boolean;
    readonly diagnostics: readonly Diagnostic[];
}

export declare function loadStemConfig(projectRoot: string): Promise<ConfigResult<ResolvedStemConfig>>;

export declare interface MutationResult {
    readonly success: boolean;
    readonly changedFiles: readonly string[];
    readonly affectedReferences: number;
    readonly diagnostics: readonly Diagnostic[];
    readonly error?: OperationError;
    readonly stage?: 'preparation' | 'revalidation' | 'source' | 'configuration' | 'history';
}

export declare interface OperationError {
    readonly code: OperationErrorCode;
    readonly message: string;
    readonly path?: string;
    readonly cause?: unknown;
}

export declare type OperationErrorCode = 'PROJECT_ROOT_NOT_FOUND' | 'CONFIG_ERROR' | 'FS_ERROR' | 'CACHE_ERROR' | 'INVALID_OPERATION' | 'CONFLICT' | 'NETWORK_ERROR' | 'AUTH_ERROR';

export declare type OperationResult<T> = {
    readonly success: true;
    readonly data: T;
} | {
    readonly success: false;
    readonly error: OperationError;
};

export declare interface OutputFailure {
    readonly code: string;
    readonly message: string;
    readonly stage: 'planning' | 'preparation' | 'coordination' | 'publication' | 'tracking' | 'cleanup' | 'release';
    readonly root: string;
    readonly outputSet?: string;
    readonly path?: string;
}

export declare type OutputSelection = {
    readonly kind: 'all';
} | {
    readonly kind: 'sets';
    readonly sets: readonly {
        readonly name: string;
        readonly targets?: readonly string[];
    }[];
};

export declare interface PreviewOptions extends ProjectOperationOptions {
    readonly limits?: CompositionLimits;
}

export declare type PreviewResult = CompositionResult;

/** Read-only evaluation; partial content and scoped diagnostics are separate. */
export declare function previewSource(selector: SourceSelector, options?: PreviewOptions): Promise<OperationResult<PreviewResult>>;

export declare interface ProjectOperationOptions {
    readonly startDir?: string;
    readonly strictExternal?: boolean;
    readonly useRemote?: boolean;
}

export declare interface PublicationTarget {
    readonly root: string;
    readonly outputSet: string;
    readonly path: string;
    readonly status: 'published' | 'skipped' | 'not-published';
    readonly tracking: 'unchanged' | 'persisted' | 'failed';
    readonly reason?: string;
}

export declare interface PublishGraphResult {
    readonly namespace: string;
    readonly uploadedTo: string;
}

export declare interface ReferenceRow {
    readonly sourceId: string;
    readonly range: SourceRange;
    readonly owner?: BlockRow;
}

export declare function renameBlock(oldId: string, newId: string, options?: ProjectOperationOptions): Promise<MutationResult>;

/** Prepare all selected mappings, then publish through producer-owned root coordination. */
export declare function renderOutputs(selection: OutputSelection, options?: PreviewOptions): Promise<RenderResult>;

export declare interface RenderResult {
    readonly success: boolean;
    readonly targets: readonly (PublicationTarget & {
        readonly diagnostics: readonly Diagnostic[];
    })[];
    readonly cleanup: readonly CleanupOutcome[];
    readonly errors: readonly OutputFailure[];
}

export declare interface ResolvedStemConfig extends PortableStemConfig {
    projectRoot: string;
}

export declare function resolveStemConfig(raw: Partial<StemConfig>, projectRoot: string): ConfigResult<ResolvedStemConfig>;

export declare type SourceSelector = OutputSource;

export declare function syncProject(options?: ProjectOperationOptions): Promise<OperationResult<SyncResult>>;

export declare interface SyncResult {
    readonly scannedFiles: number;
    readonly parsedFiles: number;
    readonly graphNodes: number;
    readonly graphEdges: number;
    readonly durationMs: number;
}

export { }
