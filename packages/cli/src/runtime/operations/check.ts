import type { CheckResult, OperationResult, ProjectOperationOptions } from '../types/index.js';
import { loadProjectGraph, projectDiagnostics } from './project.js';
export async function checkProject(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<CheckResult>> {
  const start = Date.now();
  const loaded = await loadProjectGraph(options);
  if (!loaded.success) return loaded;
  const diagnostics = await projectDiagnostics(loaded.data, options);
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  return {
    success: true,
    data: Object.freeze({
      diagnostics,
      errors,
      warnings: diagnostics.length - errors,
      valid: errors === 0,
      scannedFiles: loaded.data.files.length,
      durationMs: Date.now() - start
    })
  };
}
