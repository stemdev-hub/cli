import { BlockParameter } from '@stemdev/core';
import { BlockRefSyntax } from '@stemdev/core';
import { ConfigResult } from '@stemdev/core';
import { DependencyRef } from '@stemdev/core';
import { GraphEdge } from '@stemdev/core';
import { GraphNode } from '@stemdev/core';
import { PortableStemConfig } from '@stemdev/core';
import { StemConfig } from '@stemdev/core';
import { ValidationResult } from '@stemdev/core';

export declare function addBlockToView(blockId: string, viewId: string, options?: AddRefOptions): Promise<OperationResult<AddRefResult>>;

export declare interface AddRefOptions extends ProjectOperationOptions {
    section?: string;
    tag?: string;
}

export declare interface AddRefResult {
    blockId: string;
    viewId: string;
    viewFilePath: string;
    section: string | null;
    tag: string | null;
    refString: string;
}

export declare interface CachedBlock {
    id: string;
    tags: string[];
    dependsOn: DependencyRef[];
    sections: CachedSection[];
    standaloneTags: CachedTag[];
}

export declare interface CachedBlockRef {
    namespace: string | null;
    blockId: string;
    section: string | null;
    tag: string | null;
    parameters: readonly BlockParameter[];
    syntax: BlockRefSyntax;
    raw: string;
}

export declare interface CachedSection {
    name: string;
    tags: CachedTag[];
    externalTags: CachedTag[];
    prose: string;
}

export declare interface CachedTag {
    name: string;
    section: string | null;
    content: string;
}

export declare interface CachedView {
    id: string;
    group: string | null;
    blockRefs: CachedBlockRef[];
}

export declare interface CacheIndex {
    version: string;
    entries: Record<string, CacheIndexEntry>;
}

export declare interface CacheIndexEntry {
    filePath: string;
    relativePath: string;
    type: 'block' | 'view';
    dev: string;
    inode: string;
    size: number;
    mtimeMs: number;
    sha256: string;
    parsed: CachedBlock | CachedView;
}

export declare interface CacheInvalidationResult {
    added: FileInvalidation[];
    changed: FileInvalidation[];
    unchanged: FileInvalidation[];
    metadataChanged: FileInvalidation[];
    deleted: CacheIndexEntry[];
}

export declare function checkProject(options?: ProjectOperationOptions): Promise<OperationResult<CheckResult>>;

export declare interface CheckResult {
    validation: ValidationResult;
    scannedFiles: number;
    durationMs: number;
}

export declare function createBlock(name: string, options?: CreateBlockOptions): Promise<OperationResult<CreateBlockResult>>;

export declare interface CreateBlockOptions extends ProjectOperationOptions {
    tag?: string;
}

export declare interface CreateBlockResult {
    id: string;
    filePath: string;
    relativePath: string;
    scaffolded: boolean;
    scaffoldedTag: string | null;
}

export declare function createGroup(groupPath: string, options?: ProjectOperationOptions): Promise<OperationResult<CreateGroupResult>>;

export declare interface CreateGroupResult {
    groupPath: string;
    absolutePath: string;
}

export declare function createView(name: string, options?: CreateViewOptions): Promise<OperationResult<CreateViewResult>>;

export declare interface CreateViewOptions extends ProjectOperationOptions {
    group?: string;
}

export declare interface CreateViewResult {
    id: string;
    filePath: string;
    relativePath: string;
    group: string | null;
}

export declare function deleteBlock(id: string, options?: DeleteOptions): Promise<OperationResult<DeleteResult>>;

export declare interface DeleteOptions extends ProjectOperationOptions {
    force?: boolean;
}

export declare interface DeleteResult {
    id: string;
    filePath: string;
    relativePath: string;
    referencingIds: string[];
    forced: boolean;
}

export declare function deleteView(id: string, options?: DeleteOptions): Promise<OperationResult<DeleteResult>>;

export declare interface DiscoveredFile {
    filePath: string;
    relativePath: string;
    type: 'block' | 'view';
}

export declare interface FetchNamespacesResult {
    successes: string[];
    skipped: string[];
    warnings: string[];
}

export declare interface FileInvalidation {
    filePath: string;
    relativePath: string;
    type: 'block' | 'view';
    stats: FileStats;
    sha256?: string;
    cached?: CacheIndexEntry;
}

export declare interface FileStats {
    filePath: string;
    size: number;
    mtimeMs: number;
    dev: string;
    inode: string;
}

export declare function getDefaultStemConfig(projectRoot: string): ResolvedStemConfig;

export declare interface GraphSnapshot {
    version: string;
    generatedAt: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    blockUsedInViews: Record<string, string[]>;
    viewUsesBlocks: Record<string, string[]>;
    blockDependsOn: Record<string, DependencyRef[]>;
    blockDependents: Record<string, string[]>;
}

export declare function initProject(options?: InitProjectOptions): Promise<OperationResult<InitResult>>;

export declare interface InitProjectOptions extends ProjectOperationOptions {
    force?: boolean;
}

export declare interface InitResult {
    projectRoot: string;
    blocksDir: string;
    viewsDir: string;
}

export declare function listBlocks(options?: ListBlocksOptions): Promise<OperationResult<ListBlocksResult>>;

export declare interface ListBlocksOptions extends ProjectOperationOptions {
    tag?: string;
}

export declare interface ListBlocksResult {
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

export declare function listViews(options?: ListViewsOptions): Promise<OperationResult<ListViewsResult>>;

export declare interface ListViewsOptions extends ProjectOperationOptions {
    blockId?: string;
}

export declare interface ListViewsResult {
    views: Array<{
        id: string;
        group: string | null;
        relativePath: string;
        blockCount: number;
        blockIds: string[];
    }>;
    total: number;
}

export declare function loadStemConfig(projectRoot: string): Promise<ConfigResult<ResolvedStemConfig>>;

export declare interface OperationError {
    code: OperationErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

export declare type OperationErrorCode = 'PROJECT_ROOT_NOT_FOUND' | 'CONFIG_ERROR' | 'FS_ERROR' | 'CACHE_ERROR' | 'INVALID_OPERATION' | 'CONFLICT' | 'NETWORK_ERROR' | 'AUTH_ERROR';

export declare type OperationResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: OperationError;
};

export declare type PreviewResult = RenderResult;

export declare function previewView(viewId: string, options?: PreviewViewOptions): Promise<OperationResult<PreviewResult>>;

export declare type PreviewViewOptions = ProjectOperationOptions;

export declare interface ProjectOperationOptions {
    startDir?: string;
    strictExternal?: boolean;
    useRemote?: boolean;
}

export declare interface PublishGraphResult {
    namespace: string;
    uploadedTo: string;
}

export declare function renameBlock(oldId: string, newId: string, options?: ProjectOperationOptions): Promise<OperationResult<RenameResult>>;

export declare interface RenameResult {
    oldId: string;
    newId: string;
    blockFilePath: string;
    updatedFiles: string[];
    updatedRefCount: number;
}

export declare function renderAll(options?: RenderAllOptions): Promise<OperationResult<RenderResult>>;

export declare type RenderAllOptions = RenderOptions;

export declare interface RenderedViewResult {
    id: string;
    relativePath: string;
    outputPath: string | null;
    outputRelativePath: string | null;
    markdown: string | null;
}

export declare interface RenderOptions extends ProjectOperationOptions {
    outDir?: string;
}

export declare interface RenderResult {
    views: RenderedViewResult[];
    total: number;
    outDir: string | null;
}

export declare function renderView(viewId: string, options?: RenderViewOptions): Promise<OperationResult<RenderResult>>;

export declare interface RenderViewOptions extends RenderOptions {
    stdout?: boolean;
}

export declare interface ResolvedStemConfig extends PortableStemConfig {
    projectRoot: string;
}

export declare function resolveStemConfig(raw: Partial<StemConfig>, projectRoot: string): ConfigResult<ResolvedStemConfig>;

export declare function syncProject(options?: ProjectOperationOptions): Promise<OperationResult<SyncResult>>;

export declare interface SyncResult {
    scannedFiles: number;
    parsedFiles: number;
    cachedFiles: number;
    graphNodes: number;
    graphEdges: number;
    durationMs: number;
}

export { }
