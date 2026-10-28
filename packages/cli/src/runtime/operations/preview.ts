import { compose, DEFAULT_COMPOSITION_LIMITS } from '@stemdev/core';
import type {
  OperationResult,
  PreviewOptions,
  PreviewResult,
  SourceSelector
} from '../types/index.js';
import { compositionTarget, loadProjectGraph, publicDiagnostics } from './project.js';
/** Read-only evaluation; partial content and scoped diagnostics are separate. */
export async function previewSource(
  selector: SourceSelector,
  options: PreviewOptions = {}
): Promise<OperationResult<PreviewResult>> {
  const loaded = await loadProjectGraph(options);
  if (!loaded.success) return loaded;
  const target = compositionTarget(loaded.data, selector);
  if (!target.success) return target;
  const result = compose(
    loaded.data.analysis,
    target.data,
    options.limits ?? DEFAULT_COMPOSITION_LIMITS
  );
  return {
    success: true,
    data: Object.freeze({ ...result, diagnostics: publicDiagnostics(result.diagnostics) })
  };
}
