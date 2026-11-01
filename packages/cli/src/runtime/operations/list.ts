import { findBlocksByTag, isBlockId, resolveBlockReference } from '@stemdev/core';
import type { Definition } from '@stemdev/core';
import type {
  BlockRow,
  ListBlocksOptions,
  ListBlocksResult,
  ListOutputsResult,
  ListReferencesResult,
  OperationResult,
  ProjectOperationOptions
} from '../types/index.js';
import { loadProjectGraph, publicDiagnostics } from './project.js';
import { operationError, fromConfigError, fromFsError } from './errors.js';
import { findProjectRoot } from '../fs/finder.js';
import { loadStemConfig } from '../config/index.js';
export function blockRow(block: Definition): BlockRow {
  return Object.freeze({
    sourceId: block.source.tree.source.sourceId,
    range: Object.freeze({ ...block.syntax.range }),
    ...(block.id === undefined ? {} : { id: block.id }),
    tags: Object.freeze([...block.tags])
  });
}
export async function listBlocks(
  options: ListBlocksOptions = {}
): Promise<OperationResult<ListBlocksResult>> {
  const loaded = await loadProjectGraph(options);
  if (!loaded.success) return loaded;
  const { analysis } = loaded.data;
  const all = analysis.localInstance!.sources.flatMap((s) => s.definitions);
  const selection =
    options.tag === undefined
      ? {
          blocks: all,
          classificationComplete: all.every((d) => d.classificationComplete),
          diagnostics: analysis.diagnostics
        }
      : findBlocksByTag(analysis, analysis.localInstance, options.tag);
  return {
    success: true,
    data: Object.freeze({
      blocks: Object.freeze(selection.blocks.map(blockRow)),
      total: selection.blocks.length,
      classificationComplete: selection.classificationComplete,
      diagnostics: publicDiagnostics(selection.diagnostics)
    })
  };
}
export async function listReferences(
  id: string,
  options: ProjectOperationOptions = {}
): Promise<OperationResult<ListReferencesResult>> {
  const loaded = await loadProjectGraph(options);
  if (!loaded.success) return loaded;
  const { analysis } = loaded.data;
  if (!isBlockId(id))
    return {
      success: false,
      error: operationError('INVALID_OPERATION', 'Invalid local Block ID.')
    };
  const selected = resolveBlockReference(analysis, analysis.localInstance, { id });
  if (selected.status !== 'resolved')
    return {
      success: false,
      error: operationError(
        'INVALID_OPERATION',
        'Block selection is missing, unavailable or ambiguous.'
      )
    };
  const sources = analysis.localInstance!.sources;
  const inclusions = sources.flatMap((s) => s.inclusions);
  const references = inclusions
    .filter((r) => r.resolution.status === 'resolved' && r.resolution.target === selected.target)
    .map((r) =>
      Object.freeze({
        sourceId: r.source.tree.source.sourceId,
        range: Object.freeze({ ...r.syntax.range }),
        ...(r.owner ? { owner: blockRow(r.owner) } : {})
      })
    );
  return {
    success: true,
    data: Object.freeze({
      references: Object.freeze(references),
      total: references.length,
      complete:
        sources.every(
          (s) => s.referencesComplete && s.definitions.every((d) => d.referencesComplete)
        ) && inclusions.every((r) => r.resolution.status === 'resolved'),
      diagnostics: publicDiagnostics(analysis.diagnostics)
    })
  };
}
export async function listOutputs(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<ListOutputsResult>> {
  const root = await findProjectRoot(options.startDir ?? process.cwd());
  if (!root.success) return { success: false, error: fromFsError(root.error) };
  const config = await loadStemConfig(root.data);
  if (!config.success) return { success: false, error: fromConfigError(config.error) };
  return { success: true, data: Object.freeze({ outputSets: config.data.outputSets }) };
}
