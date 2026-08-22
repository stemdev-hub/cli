import path from 'node:path';

import type {
  CreateBlockOptions,
  CreateBlockResult,
  CreateGroupResult,
  CreateViewOptions,
  CreateViewResult,
  OperationResult,
  ProjectOperationOptions
} from '@stem/types';
import { loadStemConfig } from '../config/index.js';
import { findProjectRoot } from '../fs/finder.js';
import { toRelativePath } from '../fs/reader.js';
import { ensureDir, writeFile } from '../fs/writer.js';
import { fromConfigError, fromFsError, operationError } from './errors.js';

export async function createBlock(
  name: string,
  options: CreateBlockOptions = {}
): Promise<OperationResult<CreateBlockResult>> {
  const projectResult = await loadCreateProject(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const idResult = createSuffixedId(name, 'block');
  if (!idResult.success) {
    return idResult;
  }

  const tag = normalizeOptionalName(options.tag);
  const filePath = path.join(projectResult.data.projectRoot, projectResult.data.config.blocksDir, `${idResult.data}.md`);
  const content = createBlockContent(idResult.data, tag);
  const writeResult = await writeCreatedFile(filePath, content);
  if (!writeResult.success) {
    return writeResult;
  }

  return {
    success: true,
    data: {
      id: idResult.data,
      filePath,
      relativePath: toRelativePath(filePath, projectResult.data.projectRoot),
      scaffolded: tag !== null,
      scaffoldedTag: tag
    }
  };
}

export async function createView(
  name: string,
  options: CreateViewOptions = {}
): Promise<OperationResult<CreateViewResult>> {
  const projectResult = await loadCreateProject(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const idResult = createSuffixedId(name, 'view');
  if (!idResult.success) {
    return idResult;
  }

  const groupResult = normalizeOptionalGroupPath(options.group);
  if (!groupResult.success) {
    return groupResult;
  }

  const group = groupResult.data;
  const viewsDir = path.join(projectResult.data.projectRoot, projectResult.data.config.viewsDir);
  const filePath = path.join(viewsDir, ...(group === null ? [] : group.split('/')), `${idResult.data}.md`);
  const content = createViewContent(idResult.data, group);
  const writeResult = await writeCreatedFile(filePath, content);
  if (!writeResult.success) {
    return writeResult;
  }

  return {
    success: true,
    data: {
      id: idResult.data,
      filePath,
      relativePath: toRelativePath(filePath, projectResult.data.projectRoot),
      group
    }
  };
}

export async function createGroup(
  groupPath: string,
  options: ProjectOperationOptions = {}
): Promise<OperationResult<CreateGroupResult>> {
  const projectResult = await loadCreateProject(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const groupResult = normalizeGroupPath(groupPath);
  if (!groupResult.success) {
    return groupResult;
  }

  const absolutePath = path.join(
    projectResult.data.projectRoot,
    projectResult.data.config.viewsDir,
    ...groupResult.data.split('/')
  );
  const ensureResult = await ensureDir(absolutePath);
  if (!ensureResult.success) {
    return { success: false, error: fromFsError(ensureResult.error) };
  }

  return {
    success: true,
    data: {
      groupPath: groupResult.data,
      absolutePath
    }
  };
}

interface CreateProject {
  projectRoot: string;
  config: {
    blocksDir: string;
    viewsDir: string;
  };
}

async function loadCreateProject(
  options: ProjectOperationOptions
): Promise<OperationResult<CreateProject>> {
  const projectRootResult = await findProjectRoot(options.startDir ?? process.cwd());
  if (!projectRootResult.success) {
    return { success: false, error: fromFsError(projectRootResult.error) };
  }

  const configResult = await loadStemConfig(projectRootResult.data);
  if (!configResult.success) {
    return { success: false, error: fromConfigError(configResult.error) };
  }

  return {
    success: true,
    data: {
      projectRoot: projectRootResult.data,
      config: {
        blocksDir: configResult.data.blocksDir,
        viewsDir: configResult.data.viewsDir
      }
    }
  };
}

function createSuffixedId(name: string, suffix: 'block' | 'view'): OperationResult<string> {
  const slugResult = slugifyName(name);
  if (!slugResult.success) {
    return slugResult;
  }

  const suffixText = `-${suffix}`;
  return {
    success: true,
    data: slugResult.data.endsWith(suffixText) ? slugResult.data : `${slugResult.data}${suffixText}`
  };
}

function slugifyName(name: string): OperationResult<string> {
  const slug = name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

  if (slug.length === 0) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', 'Name must contain at least one letter or number.')
    };
  }

  return { success: true, data: slug };
}

function normalizeOptionalName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function normalizeOptionalGroupPath(value: string | undefined): OperationResult<string | null> {
  if (value === undefined || value.trim().length === 0) {
    return { success: true, data: null };
  }

  return normalizeGroupPath(value);
}

function normalizeGroupPath(value: string): OperationResult<string> {
  const normalized = value.trim().replaceAll('\\', '/').replaceAll(/\/+/g, '/').replaceAll(/^\/|\/$/g, '');

  if (normalized.length === 0) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', 'Group path must not be empty.')
    };
  }

  if (path.isAbsolute(value) || path.win32.isAbsolute(value) || path.posix.isAbsolute(value)) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Group path "${value}" must be project-relative.`)
    };
  }

  if (normalized.split('/').includes('..')) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Group path "${value}" must not contain "..".`)
    };
  }

  return { success: true, data: normalized };
}

async function writeCreatedFile(filePath: string, content: string): Promise<OperationResult<void>> {
  const result = await writeFile(filePath, content);
  if (result.success) {
    return { success: true, data: undefined };
  }

  return {
    success: false,
    error:
      result.error.code === 'ALREADY_EXISTS'
        ? operationError('CONFLICT', result.error.message, { path: result.error.path, cause: result.error })
        : fromFsError(result.error)
  };
}

function createBlockContent(id: string, tag: string | null): string {
  const body =
    tag === null
      ? ''
      : `
@stem[tag:${tag}]

@stem[end]
`;

  return `---
id: ${id}
---
${body}`;
}

function createViewContent(id: string, group: string | null): string {
  const groupLine = group === null ? '' : `group: ${group}\n`;

  return `---
id: ${id}
${groupLine}---
`;
}
