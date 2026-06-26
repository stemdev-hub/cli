import { performance } from 'node:perf_hooks';

import type { CheckResult, OperationResult, ProjectOperationOptions } from '@stem/types';
import { loadProjectForCheck, validateLoadedProject } from './project.js';

export async function checkProject(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<CheckResult>> {
  const startedAt = performance.now();
  const projectResult = await loadProjectForCheck(options);
  const durationMs = Math.trunc(performance.now() - startedAt);

  if (!projectResult.success) {
    return projectResult;
  }

  return {
    success: true,
    data: {
      validation: validateLoadedProject(projectResult.data),
      scannedFiles: projectResult.data.blockFiles.length + projectResult.data.viewFiles.length,
      durationMs
    }
  };
}
