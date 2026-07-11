import type { DeleteOptions, DeleteResult, OperationResult, StemGraph } from '@stem/types';
import { deleteFile } from '../fs/writer.js';
import { fromFsError, operationError } from './errors.js';
import { loadProjectGraph } from './project.js';

export async function deleteBlock(
  id: string,
  options: DeleteOptions = {}
): Promise<OperationResult<DeleteResult>> {
  const projectResult = await loadProjectGraph(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const block = projectResult.data.blocks.find((candidate) => candidate.id === id);
  if (block === undefined) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Block "${id}" was not found.`)
    };
  }

  const referencingIds = getBlockReferencingIds(projectResult.data.graph, id);
  const forced = options.force ?? false;
  if (referencingIds.length > 0 && !forced) {
    return {
      success: false,
      error: operationError(
        'CONFLICT',
        `Block "${id}" is still referenced by: ${referencingIds.join(', ')}.`,
        { path: block.filePath }
      )
    };
  }

  const deleteResult = await deleteFile(block.filePath);
  if (!deleteResult.success) {
    return { success: false, error: fromFsError(deleteResult.error) };
  }

  return {
    success: true,
    data: {
      id,
      filePath: block.filePath,
      relativePath: block.relativePath,
      referencingIds,
      forced
    }
  };
}

export async function deleteView(
  id: string,
  options: DeleteOptions = {}
): Promise<OperationResult<DeleteResult>> {
  const projectResult = await loadProjectGraph(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const view = projectResult.data.views.find((candidate) => candidate.id === id);
  if (view === undefined) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `View "${id}" was not found.`)
    };
  }

  const deleteResult = await deleteFile(view.filePath);
  if (!deleteResult.success) {
    return { success: false, error: fromFsError(deleteResult.error) };
  }

  return {
    success: true,
    data: {
      id,
      filePath: view.filePath,
      relativePath: view.relativePath,
      referencingIds: [],
      forced: options.force ?? false
    }
  };
}

function getBlockReferencingIds(graph: StemGraph, blockId: string): string[] {
  return [
    ...(graph.blockUsedInViews.get(blockId) ?? []),
    ...(graph.blockDependents.get(blockId) ?? [])
  ].sort();
}
