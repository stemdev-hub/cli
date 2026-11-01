import path from 'node:path';
import { realpath, readFile as readText, stat } from 'node:fs/promises';
import {
  analyzeProject,
  parseBlockReference,
  validateExternalReferences,
  parseConfigJson,
  normalizeStemConfig
} from '@stemdev/core';
import type {
  Diagnostic,
  ProjectAnalysis,
  SourceDocument,
  OutputSource,
  CompositionTarget,
  SourceLocation
} from '@stemdev/core';
import type {
  OperationResult,
  ProjectOperationOptions,
  ResolvedStemConfig,
  DiscoveredFile
} from '../types/index.js';
import { loadStemConfig } from '../config/index.js';
import { findBlockFiles, findProjectRoot, within } from '../fs/finder.js';
import { fromConfigError, fromFsError, operationError } from './errors.js';
import { loadExternalGraphs } from './external.js';
export interface LoadedProject {
  readonly projectRoot: string;
  readonly config: ResolvedStemConfig;
  readonly configText: string;
  readonly files: readonly DiscoveredFile[];
  readonly sources: readonly SourceDocument[];
  readonly analysis: ProjectAnalysis;
}
/** Fresh source analysis; no persisted graph or metadata is used as authored source. */
export async function loadProjectGraph(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<LoadedProject>> {
  const root = await findProjectRoot(options.startDir ?? process.cwd());
  if (!root.success) return { success: false, error: fromFsError(root.error) };
  const loaded = await loadStemConfig(root.data);
  if (!loaded.success) return { success: false, error: fromConfigError(loaded.error) };
  const config = loaded.data;
  const found = await findBlockFiles(root.data, config);
  if (!found.success) return { success: false, error: fromFsError(found.error) };
  try {
    const configText = await readText(path.join(root.data, '.stem/config.json'), 'utf8');
    // Validate the exact configuration bytes retained for subsequent mutation checks.
    const parsed = parseConfigJson(configText, path.join(root.data, '.stem/config.json'));
    const current = parsed.success
      ? normalizeStemConfig(parsed.data, path.join(root.data, '.stem/config.json'))
      : parsed;
    if (
      !current.success ||
      JSON.stringify(current.data) !==
        JSON.stringify(
          Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'projectRoot'))
        )
    )
      return {
        success: false,
        error: operationError('CONFLICT', 'Configuration changed during loading.')
      };
    const files = found.data.map((filePath) => ({
      filePath,
      relativePath: path.relative(root.data, filePath).split(path.sep).join('/')
    }));
    const sources: SourceDocument[] = [];
    for (const file of files)
      sources.push({ sourceId: file.relativePath, content: await readText(file.filePath, 'utf8') });
    const localInstance = {};
    const targets = Object.values(config.outputSets).flatMap((set) =>
      set.targets.map((target) =>
        target.source.kind === 'block'
          ? { kind: 'block' as const, reference: parseBlockReference(target.source.ref)! }
          : { kind: 'file' as const, sourceId: target.source.path }
      )
    );
    const analysis = analyzeProject({
      localInstance,
      instances: [
        {
          handle: localInstance,
          sources,
          bindings: Object.keys(config.namespaces).map((alias) => ({
            alias,
            unavailable: 'unavailable-source' as const
          }))
        }
      ],
      outputs: { targets, complete: true }
    });
    return {
      success: true,
      data: { projectRoot: root.data, config, configText, files, sources, analysis }
    };
  } catch (cause) {
    return {
      success: false,
      error: operationError('FS_ERROR', 'Cannot load current project sources.', { cause })
    };
  }
}
export async function projectDiagnostics(
  project: LoadedProject,
  options: ProjectOperationOptions
): Promise<readonly Diagnostic[]> {
  const snapshots = await loadExternalGraphs(project.config, options);
  return publicDiagnostics([
    ...project.analysis.diagnostics,
    ...validateExternalReferences(project.analysis, project.config.namespaces, snapshots, {
      nowMs: Date.now(),
      strictExternal: options.strictExternal ?? false
    })
  ]);
}
/** Remove evaluation-local identity from adapter results. Source locations remain transient. */
export function publicDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  const locate = (location: SourceLocation): SourceLocation =>
    Object.freeze({ sourceId: location.sourceId, range: Object.freeze({ ...location.range }) });
  return Object.freeze(
    diagnostics.map((d) =>
      Object.freeze({
        code: d.code,
        severity: d.severity,
        message: d.message,
        ...(d.location ? { location: locate(d.location) } : {}),
        ...(d.related ? { related: Object.freeze(d.related.map(locate)) } : {})
      })
    )
  );
}
export function compositionTarget(
  project: LoadedProject,
  selector: OutputSource
): OperationResult<CompositionTarget> {
  const instance = project.analysis.localInstance!;
  if (selector.kind === 'block') {
    const reference = parseBlockReference(selector.ref);
    return reference
      ? { success: true, data: { kind: 'block', instance, reference } }
      : { success: false, error: operationError('INVALID_OPERATION', 'Invalid Block reference.') };
  }
  const sourceId = selector.path.replaceAll('\\', '/');
  if (
    sourceId !== path.posix.normalize(sourceId) ||
    !sourceId.startsWith(project.config.blocksDir + '/') ||
    path.isAbsolute(sourceId) ||
    sourceId.split('/').includes('..')
  )
    return {
      success: false,
      error: operationError(
        'INVALID_OPERATION',
        'File selector must name a project-relative source beneath blocksDir.'
      )
    };
  return { success: true, data: { kind: 'file', instance, sourceId } };
}
/** Resolve existing ancestors too, so missing authoring destinations cannot escape via symlinks. */
export async function sourceDestination(project: LoadedProject, relative: string): Promise<string> {
  if (
    !relative.endsWith('.md') ||
    relative.includes('\\') ||
    relative !== path.posix.normalize(relative) ||
    relative
      .slice(project.config.blocksDir.length + 1)
      .split('/')
      .some((p) => p === '..' || p.startsWith('.') || p === 'node_modules' || p === 'dist') ||
    !relative.startsWith(project.config.blocksDir + '/')
  )
    throw new Error('Destination must be a discoverable project-relative Markdown source.');
  const destination = path.resolve(project.projectRoot, relative);
  const sourceRoot = path.resolve(project.projectRoot, project.config.blocksDir);
  let existing = destination;
  for (;;) {
    try {
      await stat(existing);
      break;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      existing = parent;
    }
  }
  const physicalRoot = await realpath(project.projectRoot);
  const physical = await realpath(existing);
  if (!within(physicalRoot, physical)) throw new Error('Destination escapes the project.');
  const physicalSource = await realpath(sourceRoot).catch(() => sourceRoot);
  if (within(sourceRoot, existing) && !within(physicalSource, physical))
    throw new Error('Destination escapes blocksDir.');
  if (!within(physicalRoot, physicalSource)) throw new Error('blocksDir escapes the project.');
  return destination;
}
