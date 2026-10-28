import type { CleanupOptions } from '../types/index.js';
import type { CleanupResult } from '../output/cleanup.js';
import { cleanupOutputs as applyCleanup, failure } from '../output/cleanup.js';
import { outputProtection, outputRoot } from './render.js';
import { loadStemConfig } from '../config/index.js';
import { findProjectRoot } from '../fs/finder.js';
/** Assess by default; apply only explicitly, under the current producer's identity. */
export async function cleanupOutputs(options: CleanupOptions): Promise<CleanupResult> {
  const root = await findProjectRoot(options.startDir ?? process.cwd());
  const failed = (code: string, message: string): CleanupResult => ({
    success: false,
    outcomes: [],
    errors: [{ code, message, stage: 'planning', root: options.outputDir, outputSet: options.set }]
  });
  if (!root.success) return failed(root.error.code, root.error.message);
  const config = await loadStemConfig(root.data);
  if (!config.success) return failed(config.error.code, config.error.message);
  try {
    return await applyCleanup(
      {
        root: await outputRoot(config.data, options.outputDir),
        projectId: config.data.projectId,
        outputSet: options.set
      },
      await outputProtection(config.data),
      options.apply ?? false
    );
  } catch (error) {
    return {
      success: false,
      outcomes: [],
      errors: [failure(error, 'planning', options.outputDir, options.set)]
    };
  }
}
