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

export declare interface BlockParameter {
    name: string;
    value: string;
}

export declare interface BlockRef extends CachedBlockRef {
    position: Position;
}

export declare type BlockRefSyntax = 'legacy' | 'extended';

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

export declare interface ConfigError {
    code: ConfigErrorCode;
    message: string;
    path: string;
}

export declare type ConfigErrorCode = 'CONFIG_NOT_FOUND' | 'CONFIG_READ_FAILED' | 'CONFIG_INVALID_JSON' | 'CONFIG_INVALID_SCHEMA' | 'CONFIG_INVALID_PATH' | 'CONFIG_UNSUPPORTED_VERSION';

export declare type ConfigResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: ConfigError;
};

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

export declare interface DependencyRef {
    blockId: string;
    section: string | null;
    tag: string | null;
    raw: string;
}

export declare interface DiscoveredFile {
    filePath: string;
    relativePath: string;
    type: 'block' | 'view';
}

export declare type EdgeType = 'view-uses-block' | 'block-depends-on';

export declare interface ExternalBlockEntry {
    id: string;
    tags: string[];
    sections: Array<{
        id: string;
        tags: string[];
    }>;
}

export declare interface ExternalRenameEntry {
    from: string;
    to: string;
    since: string;
}

export declare interface ExternalSnapshotState {
    graph: ExternalStemGraph;
    fetchedAt: string;
    isLocalFallback: boolean;
}

export declare interface ExternalStemGraph {
    version: string;
    namespace: string;
    publishedAt: string;
    contentSha: string;
    blocks: ExternalBlockEntry[];
    renames: ExternalRenameEntry[];
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

export declare interface GraphEdge {
    type: EdgeType;
    from: string;
    to: string;
    section: string | null;
    tag: string | null;
}

export declare interface GraphNode {
    id: string;
    type: NodeType;
    filePath: string;
    relativePath: string;
    tags: string[];
    group: string | null;
}

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
    schemasDir: string;
}

export declare function isExternalStemGraphShape(value: unknown): value is ExternalStemGraph;

export declare interface IssueContextMap {
    DUPLICATE_ID: {
        id: string;
        collidingFilePath: string;
    };
    BROKEN_BLOCK_REF: {
        targetId: string;
        rawRef: string;
    };
    BROKEN_SECTION_REF: {
        targetId: string;
        targetSection: string;
    };
    EXTERNAL_TAG_MISSING_SECTION: {
        tagName: string;
        sectionName: string;
    };
    CROSS_BLOCK_SECTION_REF: {
        sourceBlockId: string;
        targetBlockId: string;
    };
    CIRCULAR_DEPENDENCY: {
        dependencyChain: string;
    };
    SCHEMA_VIOLATION: {
        tagName: string;
        missingSections: string;
    };
    ORPHANED_BLOCK: {
        blockId: string;
    };
    DUPLICATE_TAG_IN_SECTION: {
        tagName: string;
        sectionName: string;
    };
    UNRESOLVED_TAG: {
        targetId: string;
        targetSection: string;
        missingTag: string;
    };
    INVALID_BLOCK_REF_FILTER: {
        targetId: string;
        rawRef: string;
    };
    INVALID_FRONTMATTER: {
        parseError: string;
    };
    INVALID_STEM_PARAMETER: {
        rawRef: string;
        reason: string;
    };
    MISSING_BLOCK_VARIABLE: {
        blockId: string;
        variableName: string;
        rawRef: string;
        viewPath: string;
        viewLine: number;
        viewColumn: number;
    };
    INLINE_BLOCK_REFERENCE: {
        blockId: string;
        rawRef: string;
    };
    BLOCK_REFERENCE_IN_TABLE_CELL: {
        blockId: string;
        rawRef: string;
    };
    UNRESOLVED_NAMESPACE: {
        namespace: string;
        rawRef: string;
    };
    MISSING_SNAPSHOT: {
        namespace: string;
        rawRef: string;
    };
    EXPIRED_SNAPSHOT: {
        namespace: string;
        rawRef: string;
        fetchedAt: string;
    };
}

export declare type IssueSeverity = 'error' | 'warning';

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

export declare interface NamespaceConfig {
    graphUrl?: string;
    localPath?: string;
}

export declare type NodeType = 'block' | 'view';

export declare interface OperationError {
    code: OperationErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

export declare type OperationErrorCode = 'PROJECT_ROOT_NOT_FOUND' | 'CONFIG_ERROR' | 'FS_ERROR' | 'CACHE_ERROR' | 'SCHEMA_LOAD_ERROR' | 'INVALID_OPERATION' | 'CONFLICT' | 'NETWORK_ERROR' | 'AUTH_ERROR';

export declare type OperationResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: OperationError;
};

export declare interface ParsedBlock extends Omit<CachedBlock, 'sections' | 'standaloneTags'> {
    sections: StemSection[];
    standaloneTags: StemTag[];
    filePath: string;
    relativePath: string;
    rawContent: string;
    bodyStartLine: number;
}

export declare interface ParsedView extends Omit<CachedView, 'blockRefs'> {
    blockRefs: BlockRef[];
    filePath: string;
    relativePath: string;
    localContent: string;
    bodyStartLine: number;
}

export declare interface Point {
    line: number;
    column: number;
    offset?: number;
}

export declare interface Position {
    start: Point;
    end: Point;
    indent?: number[];
}

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

export declare interface ResolvedStemConfig {
    version: string;
    namespace?: string;
    publishUrl?: string;
    projectRoot: string;
    blocksDir: string;
    viewsDir: string;
    schemasDir: string;
    cacheDir: string;
    namespaces: Record<string, NamespaceConfig>;
}

export declare function resolveStemConfig(raw: Partial<StemConfig>, projectRoot: string): ConfigResult<ResolvedStemConfig>;

export declare interface SourceRange {
    startOffset: number;
    endOffset: number;
}

export declare interface StemASTNode {
    type: string;
    data?: Record<string, unknown>;
    position?: Position;
}

export declare interface StemBlockRefNode extends StemASTNode {
    type: 'stemBlockRef';
    namespace: string | null;
    blockId: string;
    section: string | null;
    tag: string | null;
    parameters: readonly BlockParameter[];
    syntax: BlockRefSyntax;
    raw: string;
}

export declare interface StemConfig {
    version?: string;
    namespace?: string;
    publishUrl?: string;
    blocksDir?: string;
    viewsDir?: string;
    schemasDir?: string;
    cacheDir?: string;
    namespaces?: Record<string, NamespaceConfig>;
}

export declare interface StemDepNode extends StemASTNode {
    type: 'stemDep';
    blockId: string;
    section: string | null;
    tag: string | null;
    raw: string;
}

export declare interface StemGraph {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
    blockUsedInViews: Map<string, string[]>;
    viewUsesBlocks: Map<string, string[]>;
    blockDependsOn: Map<string, DependencyRef[]>;
    blockDependents: Map<string, string[]>;
}

export declare interface StemSection extends Omit<CachedSection, 'tags' | 'externalTags'> {
    tags: StemTag[];
    externalTags: StemTag[];
    position: Position;
    proseRange: SourceRange;
}

export declare interface StemSectionNode extends StemASTNode {
    type: 'stemSection';
    name: string;
    prose: string;
}

export declare interface StemTag extends CachedTag {
    position: Position;
    contentRange: SourceRange;
}

export declare interface StemTagNode extends StemASTNode {
    type: 'stemTag';
    name: string;
    section: string | null;
    content: string;
}

export declare function syncProject(options?: ProjectOperationOptions): Promise<OperationResult<SyncResult>>;

export declare interface SyncResult {
    scannedFiles: number;
    parsedFiles: number;
    cachedFiles: number;
    graphNodes: number;
    graphEdges: number;
    durationMs: number;
}

export declare interface TagSchema {
    name: string;
    required: string[];
    description?: string;
}

export declare type ValidationIssue = {
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

export declare interface ValidationResult {
    issues: ValidationIssue[];
    errorCount: number;
    warningCount: number;
    hasErrors: boolean;
    hasWarnings: boolean;
}

export { }
