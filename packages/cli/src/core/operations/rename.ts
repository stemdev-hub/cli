import path from 'node:path';
import matter from 'gray-matter';
import { dump } from 'js-yaml';

import type { OperationResult, ProjectOperationOptions, RenameResult } from '@stem/types';
import { readFile } from '../fs/reader.js';
import { writeFile } from '../fs/writer.js';
import { fromFsError, operationError } from './errors.js';
import { loadProjectGraph } from './project.js';

export async function renameBlock(
  oldId: string,
  newId: string,
  options: ProjectOperationOptions = {}
): Promise<OperationResult<RenameResult>> {
  const idResult = normalizeNewId(newId);
  if (!idResult.success) {
    return idResult;
  }

  const projectResult = await loadProjectGraph(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const block = projectResult.data.blocks.find((candidate) => candidate.id === oldId);
  if (block === undefined) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Block "${oldId}" was not found.`)
    };
  }

  if (projectResult.data.blocks.some((candidate) => candidate.id === idResult.data)) {
    return {
      success: false,
      error: operationError('CONFLICT', `Block "${idResult.data}" already exists.`)
    };
  }

  const updatedFiles = new Set<string>();
  const blockRewriteResult = await rewriteBlockFile(block.filePath, oldId, idResult.data);
  if (!blockRewriteResult.success) {
    return blockRewriteResult;
  }
  updatedFiles.add(block.filePath);

  let updatedRefCount = blockRewriteResult.data.updatedRefCount;

  for (const candidate of projectResult.data.blocks) {
    if (candidate.id === oldId) {
      continue;
    }

    const hasDependency = candidate.dependsOn.some((dep) => dep.blockId === oldId);
    if (!hasDependency) {
      continue;
    }

    const rewriteResult = await rewriteDependencyFile(candidate.filePath, oldId, idResult.data);
    if (!rewriteResult.success) {
      return rewriteResult;
    }

    if (rewriteResult.data.updatedRefCount > 0) {
      updatedFiles.add(candidate.filePath);
      updatedRefCount += rewriteResult.data.updatedRefCount;
    }
  }

  for (const view of projectResult.data.views) {
    const replacements = view.blockRefs
      .filter((blockRef) => blockRef.blockId === oldId)
      .map((blockRef) => {
        const replacementStr = blockRef.raw.replace(`block:${oldId}`, `block:${idResult.data}`);

        return {
          startOffset: blockRef.position.start.offset,
          endOffset: blockRef.position.end.offset,
          replacement: replacementStr
        };
      })
      .filter((replacement): replacement is OffsetReplacement => (
        replacement.startOffset !== undefined && replacement.endOffset !== undefined
      ));

    if (replacements.length === 0) {
      continue;
    }

    const readResult = await readFile(view.filePath);
    if (!readResult.success) {
      return { success: false, error: fromFsError(readResult.error) };
    }

    const rewriteResult = rewriteBodyReferences(readResult.data, replacements);
    if (!rewriteResult.success) {
      return rewriteResult;
    }

    const writeResult = await writeFile(view.filePath, rewriteResult.data, {
      overwrite: true
    });
    if (!writeResult.success) {
      return { success: false, error: fromFsError(writeResult.error) };
    }

    updatedFiles.add(view.filePath);
    updatedRefCount += replacements.length;
  }

  const renamesPath = path.join(projectResult.data.config.projectRoot, '.stem', 'renames.json');
  const renamesLog: Array<{ from: string; to: string; since: string }> = [];
  const renamesReadResult = await readFile(renamesPath);
  if (renamesReadResult.success) {
    try {
      const parsedRenames: unknown = JSON.parse(renamesReadResult.data);
      if (Array.isArray(parsedRenames)) {
        for (const entry of parsedRenames) {
          if (
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { from?: unknown }).from === 'string' &&
            typeof (entry as { to?: unknown }).to === 'string' &&
            typeof (entry as { since?: unknown }).since === 'string'
          ) {
            renamesLog.push(entry as { from: string; to: string; since: string });
          }
        }
      }
    } catch {
      // Ignore parse error and start fresh if corrupt
    }
  }
  renamesLog.push({
    from: oldId,
    to: idResult.data,
    since: new Date().toISOString()
  });
  const writeRenamesResult = await writeFile(renamesPath, JSON.stringify(renamesLog, null, 2), { overwrite: true });
  if (!writeRenamesResult.success) {
    return { success: false, error: fromFsError(writeRenamesResult.error) };
  }
  updatedFiles.add(renamesPath);

  return {
    success: true,
    data: {
      oldId,
      newId: idResult.data,
      blockFilePath: block.filePath,
      updatedFiles: [...updatedFiles].sort(),
      updatedRefCount
    }
  };
}

interface RewriteResult {
  updatedRefCount: number;
}

interface OffsetReplacement {
  startOffset: number;
  endOffset: number;
  replacement: string;
}

const STEM_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;

function normalizeNewId(newId: string): OperationResult<string> {
  const trimmed = newId.trim();
  if (!STEM_IDENTIFIER_PATTERN.test(trimmed)) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Block ID "${newId}" is not a valid Stem identifier.`)
    };
  }

  return { success: true, data: trimmed };
}

async function rewriteBlockFile(
  filePath: string,
  oldId: string,
  newId: string
): Promise<OperationResult<RewriteResult>> {
  const readResult = await readFile(filePath);
  if (!readResult.success) {
    return { success: false, error: fromFsError(readResult.error) };
  }

  const rewriteResult = rewriteBlockFrontmatter(readResult.data, oldId, newId);
  if (!rewriteResult.success) {
    return rewriteResult;
  }

  const writeResult = await writeFile(filePath, rewriteResult.data.content, { overwrite: true });
  if (!writeResult.success) {
    return { success: false, error: fromFsError(writeResult.error) };
  }

  return { success: true, data: { updatedRefCount: rewriteResult.data.updatedRefCount } };
}

async function rewriteDependencyFile(
  filePath: string,
  oldId: string,
  newId: string
): Promise<OperationResult<RewriteResult>> {
  const readResult = await readFile(filePath);
  if (!readResult.success) {
    return { success: false, error: fromFsError(readResult.error) };
  }

  const rewriteResult = rewriteBlockFrontmatter(readResult.data, oldId, newId);
  if (!rewriteResult.success) {
    return rewriteResult;
  }

  if (rewriteResult.data.updatedRefCount === 0) {
    return { success: true, data: { updatedRefCount: 0 } };
  }

  const writeResult = await writeFile(filePath, rewriteResult.data.content, { overwrite: true });
  if (!writeResult.success) {
    return { success: false, error: fromFsError(writeResult.error) };
  }

  return { success: true, data: { updatedRefCount: rewriteResult.data.updatedRefCount } };
}

function rewriteBlockFrontmatter(
  content: string,
  oldId: string,
  newId: string
): OperationResult<{ content: string; updatedRefCount: number }> {
  let parsed: matter.GrayMatterFile<string>;

  try {
    parsed = matter(content);
  } catch (error) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', 'Block frontmatter could not be parsed.', { cause: error })
    };
  }

  const data = { ...parsed.data } as Record<string, unknown>;
  let updatedRefCount = 0;

  if (data['id'] === oldId) {
    data['id'] = newId;
  }

  const dependencies = data['depends-on'];
  if (Array.isArray(dependencies)) {
    const updatedDependencies = dependencies.map((dependency: unknown) => {
      if (typeof dependency !== 'string') {
        return dependency;
      }

      const updated = renameDependencyRef(dependency, oldId, newId);
      if (updated !== dependency) {
        updatedRefCount += 1;
      }
      return updated;
    });

    data['depends-on'] = updatedDependencies;
  }

  return {
    success: true,
    data: {
      content: `---\n${dump(data, { lineWidth: -1, noRefs: true })}---\n${parsed.content}`,
      updatedRefCount
    }
  };
}

function renameDependencyRef(dependency: string, oldId: string, newId: string): string {
  if (dependency === oldId) {
    return newId;
  }

  if (dependency.startsWith(`${oldId}#`)) {
    return `${newId}${dependency.slice(oldId.length)}`;
  }

  return dependency;
}

function applyOffsetReplacements(content: string, replacements: OffsetReplacement[]): string {
  const sorted = [...replacements].sort((left, right) => right.startOffset - left.startOffset);
  let current = content;

  for (const replacement of sorted) {
    current = `${current.slice(0, replacement.startOffset)}${replacement.replacement}${current.slice(replacement.endOffset)}`;
  }

  return current;
}

function rewriteBodyReferences(
  content: string,
  replacements: OffsetReplacement[]
): OperationResult<string> {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch (error) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', 'Frontmatter could not be parsed.', { cause: error })
    };
  }

  const frontmatterLength = content.length - parsed.content.length;

  const globalReplacements = replacements.map((r) => ({
    startOffset: r.startOffset + frontmatterLength,
    endOffset: r.endOffset + frontmatterLength,
    replacement: r.replacement
  }));

  return {
    success: true,
    data: applyOffsetReplacements(content, globalReplacements)
  };
}
