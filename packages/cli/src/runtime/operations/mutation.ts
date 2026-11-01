import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { EditDestination, SourceEditPlan } from '@stemdev/core';
import type {
  AuthoringDestination,
  MutationResult,
  OperationError,
  ProjectOperationOptions
} from '../types/index.js';
import { loadProjectGraph, publicDiagnostics, sourceDestination } from './project.js';
import type { LoadedProject } from './project.js';
import { writeFile } from '../fs/writer.js';
import { findBlockFiles } from '../fs/finder.js';
import { fromFsError, operationError } from './errors.js';
export interface AuxiliaryEdit {
  readonly path: string;
  readonly before: string | undefined;
  readonly after: string;
  readonly stage: 'configuration' | 'history';
}
export function mutationFailure(
  error: OperationError,
  stage: MutationResult['stage'] = 'preparation'
): MutationResult {
  return Object.freeze({
    success: false,
    changedFiles: Object.freeze([]),
    affectedReferences: 0,
    diagnostics: Object.freeze([]),
    error,
    ...(stage ? { stage } : {})
  });
}
export async function editDestination(
  project: LoadedProject,
  destination: AuthoringDestination
): Promise<EditDestination> {
  if (destination.kind === 'block') return destination;
  await sourceDestination(project, destination.path);
  return { kind: 'file', sourceId: destination.path };
}
export async function optionalText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}
export async function mutate(
  options: ProjectOperationOptions,
  prepare: (
    project: LoadedProject
  ) => Promise<{
    plan: SourceEditPlan;
    auxiliary?: readonly AuxiliaryEdit[];
    additionalReferences?: number;
  }>
): Promise<MutationResult> {
  const loaded = await loadProjectGraph(options);
  if (!loaded.success) return mutationFailure(loaded.error);
  const project = loaded.data;
  const changedFiles: string[] = [];
  let affectedReferences = 0;
  let stage: MutationResult['stage'] = 'preparation';
  try {
    const { plan, auxiliary = [], additionalReferences = 0 } = await prepare(project);
    if (!plan.success)
      return Object.freeze({
        success: false,
        changedFiles: Object.freeze([]),
        affectedReferences: 0,
        diagnostics: publicDiagnostics(plan.diagnostics),
        stage: 'preparation',
        error: operationError('CONFLICT', 'Source edit is unsafe.')
      });
    affectedReferences = plan.references.length + additionalReferences;
    const expected = new Map<string, string | undefined>(
      project.sources.map((s) => [path.resolve(project.projectRoot, s.sourceId), s.content])
    );
    expected.set(path.join(project.projectRoot, '.stem/config.json'), project.configText);
    for (const item of auxiliary) expected.set(item.path, item.before);
    const writes: {
      path: string;
      before: string | undefined;
      after: string;
      stage: 'source' | 'configuration' | 'history';
      sourceId?: string;
    }[] = [];
    const edits = new Map<string, (typeof plan.edits)[number][]>();
    for (const edit of plan.edits) {
      const list = edits.get(edit.sourceId) ?? [];
      list.push(edit);
      edits.set(edit.sourceId, list);
    }
    for (const [sourceId, parts] of edits) {
      const file = await sourceDestination(project, sourceId);
      const before = expected.get(file);
      const original = before ?? '';
      let after = original;
      let boundary = original.length;
      for (const edit of [...parts].sort((a, b) => b.range.startOffset - a.range.startOffset)) {
        const { startOffset: start, endOffset: end } = edit.range;
        if (start < 0 || end < start || end > boundary)
          throw new Error('Overlapping or unavailable edit ranges.');
        after = after.slice(0, start) + edit.replacement + after.slice(end);
        boundary = start;
      }
      if (after !== before) writes.push({ path: file, before, after, stage: 'source', sourceId });
    }
    writes.push(...auxiliary.filter((item) => item.before !== item.after));
    const inventory = new Set(project.files.map((file) => file.filePath));
    const fail = (error: OperationError, stage: MutationResult['stage']): MutationResult =>
      Object.freeze({
        success: false,
        changedFiles: Object.freeze([...changedFiles]),
        affectedReferences,
        diagnostics: Object.freeze([]),
        error,
        ...(stage ? { stage } : {})
      });
    for (const write of writes) {
      stage = 'revalidation';
      const found = await findBlockFiles(project.projectRoot, project.config);
      if (!found.success) return fail(fromFsError(found.error), 'revalidation');
      if (found.data.length !== inventory.size || found.data.some((file) => !inventory.has(file)))
        return fail(
          operationError('CONFLICT', 'Source inventory changed before writing.'),
          'revalidation'
        );
      for (const [file, content] of expected)
        if ((await optionalText(file)) !== content)
          return fail(
            operationError('CONFLICT', 'Input changed before writing.', { path: file }),
            'revalidation'
          );
      if ((await optionalText(write.path)) !== write.before)
        return fail(
          operationError('CONFLICT', 'Destination changed before writing.', { path: write.path }),
          'revalidation'
        );
      if (write.sourceId) await sourceDestination(project, write.sourceId);
      stage = write.stage;
      const result = await writeFile(write.path, write.after, {
        overwrite: write.before !== undefined
      });
      if (!result.success) return fail(fromFsError(result.error), write.stage);
      changedFiles.push(path.relative(project.projectRoot, write.path).split(path.sep).join('/'));
      expected.set(write.path, write.after);
      if (write.sourceId) inventory.add(write.path);
    }
    return Object.freeze({
      success: true,
      changedFiles: Object.freeze(changedFiles),
      affectedReferences,
      diagnostics: Object.freeze([])
    });
  } catch (cause) {
    return Object.freeze({
      success: false,
      changedFiles: Object.freeze([...changedFiles]),
      affectedReferences,
      diagnostics: Object.freeze([]),
      error: operationError(
        'CONFLICT',
        cause instanceof Error ? cause.message : 'Cannot complete source edits.',
        { cause }
      ),
      ...(stage ? { stage } : {})
    });
  }
}
