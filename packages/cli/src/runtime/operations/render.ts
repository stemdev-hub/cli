import path from 'node:path';
import { compose, DEFAULT_COMPOSITION_LIMITS } from '@stemdev/core';
import type { OutputSet, Diagnostic } from '@stemdev/core';
import type {
  OutputSelection,
  PreviewOptions,
  RenderResult,
  ResolvedStemConfig
} from '../types/index.js';
import { compositionTarget, loadProjectGraph, publicDiagnostics } from './project.js';
import { resolveOutputRoot } from '../output/paths.js';
import { publishOutputs } from '../output/publication.js';
import type { PreparedOutputSet } from '../output/publication.js';
import type { CleanupProtection } from '../output/cleanup.js';
import { failure } from '../output/cleanup.js';
/** Every current set protects its destinations, including unselected sets and other roots. */
export async function outputProtection(config: ResolvedStemConfig): Promise<CleanupProtection> {
  try {
    const destinations = [];
    for (const set of Object.values(config.outputSets))
      destinations.push({
        root: await outputRoot(config, set.outputDir),
        paths: set.targets.map((t) => t.path)
      });
    return { status: 'complete', destinations };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Cannot inspect current destinations.'
    };
  }
}
export function outputRoot(config: ResolvedStemConfig, outputDir: string) {
  return resolveOutputRoot(config.projectRoot, outputDir, [
    path.join(config.projectRoot, config.blocksDir),
    path.join(config.projectRoot, config.cacheDir)
  ]);
}
/** Prepare all selected mappings, then publish through producer-owned root coordination. */
export async function renderOutputs(
  selection: OutputSelection,
  options: PreviewOptions = {}
): Promise<RenderResult> {
  const loaded = await loadProjectGraph(options);
  if (!loaded.success)
    return {
      success: false,
      targets: [],
      cleanup: [],
      errors: [
        {
          code: loaded.error.code,
          message: loaded.error.message,
          stage: 'planning',
          root: options.startDir ?? process.cwd()
        }
      ]
    };
  const project = loaded.data;
  const selected: {
    name: string;
    set: OutputSet;
    targets: OutputSet['targets'];
    complete: boolean;
  }[] = [];
  const diagnosticMap = new Map<string, readonly Diagnostic[]>();
  const prepared: PreparedOutputSet[] = [];
  try {
    const names =
      selection.kind === 'all'
        ? Object.keys(project.config.outputSets).map((name) => ({ name }))
        : selection.sets;
    if (selection.kind === 'sets' && names.length === 0)
      throw new Error('Select at least one output set.');
    const seen = new Set<string>();
    for (const item of names) {
      if (seen.has(item.name)) throw new Error('Duplicate output-set selection.');
      seen.add(item.name);
      const set = Object.hasOwn(project.config.outputSets, item.name)
        ? project.config.outputSets[item.name]
        : undefined;
      if (!set) throw new Error('Unknown output set: ' + item.name);
      const paths = 'targets' in item ? item.targets : undefined;
      if (
        paths !== undefined &&
        (paths.length === 0 ||
          new Set(paths).size !== paths.length ||
          paths.some((p) => !set.targets.some((t) => t.path === p)))
      )
        throw new Error('Unknown, empty or duplicate target selection.');
      selected.push({
        name: item.name,
        set,
        targets:
          paths === undefined
            ? set.targets
            : paths.map((p) => set.targets.find((t) => t.path === p)!),
        complete: paths === undefined
      });
    }
    for (const item of selected) {
      const root = await outputRoot(project.config, item.set.outputDir);
      const targets = item.targets.map((target) => {
        const mapped = compositionTarget(project, target.source);
        const result = mapped.success
          ? compose(project.analysis, mapped.data, options.limits ?? DEFAULT_COMPOSITION_LIMITS)
          : {
              content: '',
              complete: false,
              diagnostics: [
                {
                  code: mapped.error.code,
                  message: mapped.error.message,
                  severity: 'error' as const
                }
              ]
            };
        diagnosticMap.set(
          JSON.stringify([item.name, target.path]),
          publicDiagnostics(result.diagnostics)
        );
        const eligible = result.complete && !result.diagnostics.some((d) => d.severity === 'error');
        return {
          path: target.path,
          prepared: eligible
            ? { status: 'ready' as const, content: result.content }
            : {
                status: 'failed' as const,
                code: 'INELIGIBLE_OUTPUT',
                message: 'Composition is incomplete or has blocking diagnostics.'
              }
        };
      });
      prepared.push({
        name: item.name,
        root,
        ifExists: item.set.ifExists,
        cleanup: item.set.cleanup,
        complete: item.complete,
        targets
      });
    }
  } catch (error) {
    return {
      success: false,
      targets: selected.flatMap((item) =>
        item.targets.map((t) => ({
          root: path.resolve(project.projectRoot, item.set.outputDir),
          outputSet: item.name,
          path: t.path,
          status: 'not-published' as const,
          tracking: 'unchanged' as const,
          reason: 'Output planning failed.',
          diagnostics: diagnosticMap.get(JSON.stringify([item.name, t.path])) ?? []
        }))
      ),
      cleanup: [],
      errors: [failure(error, 'planning', project.projectRoot)]
    };
  }
  const result = await publishOutputs(
    project.config.projectId,
    prepared,
    await outputProtection(project.config)
  );
  return Object.freeze({
    ...result,
    targets: Object.freeze(
      result.targets.map((target) =>
        Object.freeze({
          ...target,
          diagnostics:
            diagnosticMap.get(JSON.stringify([target.outputSet, target.path])) ?? Object.freeze([])
        })
      )
    )
  });
}
