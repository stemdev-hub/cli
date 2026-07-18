import type { ValidationResult } from './validation.js';

export type OperationErrorCode =
  | 'PROJECT_ROOT_NOT_FOUND'
  | 'CONFIG_ERROR'
  | 'FS_ERROR'
  | 'CACHE_ERROR'
  | 'SCHEMA_LOAD_ERROR'
  | 'INVALID_OPERATION'
  | 'CONFLICT';

export interface OperationError {
  code: OperationErrorCode;
  message: string;
  path?: string;
  cause?: unknown;
}

export type OperationResult<T> =
  | { success: true; data: T }
  | { success: false; error: OperationError };

export interface ProjectOperationOptions {
  startDir?: string;
}

export interface InitProjectOptions extends ProjectOperationOptions {
  force?: boolean;
}

export interface CreateBlockOptions extends ProjectOperationOptions {
  tag?: string;
}

export interface CreateViewOptions extends ProjectOperationOptions {
  group?: string;
}

export interface AddRefOptions extends ProjectOperationOptions {
  section?: string;
  tag?: string;
}

export interface DeleteOptions extends ProjectOperationOptions {
  force?: boolean;
}

export interface ListBlocksOptions extends ProjectOperationOptions {
  tag?: string;
}

export interface ListViewsOptions extends ProjectOperationOptions {
  blockId?: string;
}

export interface RenderOptions extends ProjectOperationOptions {
  outDir?: string;
}

export interface RenderViewOptions extends RenderOptions {
  stdout?: boolean;
}

export type RenderAllOptions = RenderOptions;

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

export interface RenderedViewResult {
  id: string;
  relativePath: string;
  outputPath: string | null;
  outputRelativePath: string | null;
  markdown: string | null;
}

export interface RenderResult {
  views: RenderedViewResult[];
  total: number;
  outDir: string | null;
}
