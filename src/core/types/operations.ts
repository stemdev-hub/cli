import type { ValidationResult } from './validation.js';

// TODO: Define operation result contracts returned by core orchestration modules.
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
