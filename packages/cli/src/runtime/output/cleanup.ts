import { readFile, unlink } from 'node:fs/promises';
import { normalizeStemConfig } from '@stemdev/core';
import { acquireOutputLock, assertOutputUnlocked, releaseOutputLock, verifyOutputLock } from './lock.js';
import type { OutputLock } from './lock.js';
import { hashOutputBytes, persistOutputManifest, readOutputManifest } from './manifest.js';
import type { OutputRecord } from './manifest.js';
import { assertNoOutputCollisions, inspectOutputPaths, optionalStat, OutputError, outputError } from './paths.js';
import type { OutputPath, OutputRoot } from './paths.js';

export interface OutputFailure {
  readonly code: string;
  readonly message: string;
  readonly stage: 'planning' | 'preparation' | 'coordination' | 'publication' | 'tracking' | 'cleanup' | 'release';
  readonly root: string;
  readonly outputSet?: string;
  readonly path?: string;
}
/** The adapter must supply every current local set, including unselected sets and other roots. */
export type CleanupProtection = {
  readonly status: 'complete';
  readonly destinations: readonly { readonly root: OutputRoot; readonly paths: readonly string[] }[];
} | { readonly status: 'unavailable'; readonly reason: string };
export interface CleanupScope {
  readonly root: OutputRoot;
  readonly projectId: string;
  readonly outputSet: string;
}
export interface CleanupOutcome {
  readonly root: string;
  readonly outputSet: string;
  readonly path?: string;
  readonly action: 'retained' | 'eligible' | 'absent' | 'deleted' | 'record-removed' | 'suppressed' | 'unavailable';
  readonly reason?: string;
  /** Only present for applied changes; false preserves evidence of failed persistence. */
  readonly tracked?: boolean;
}
export interface CleanupResult {
  readonly success: boolean;
  readonly outcomes: readonly CleanupOutcome[];
  readonly errors: readonly OutputFailure[];
}

export function snapshotRoot(root: OutputRoot): OutputRoot {
  return Object.freeze({ ...root, protectedPaths: Object.freeze([...root.protectedPaths]) });
}
export function snapshotProtection(protection: CleanupProtection): CleanupProtection {
  return protection.status === 'complete'
    ? Object.freeze({ status: 'complete', destinations: Object.freeze(protection.destinations.map(item =>
      Object.freeze({ root: snapshotRoot(item.root), paths: Object.freeze([...item.paths]) }))) })
    : Object.freeze({ status: 'unavailable', reason: protection.reason });
}
export function validateProducer(projectId: string, outputSet: string, root: string): void {
  if (!normalizeStemConfig({ projectId }, 'output producer').success || typeof outputSet !== 'string' || outputSet.length === 0) {
    throw new OutputError('CONFLICT', 'A valid producer identity and nonempty output-set name are required.', root);
  }
}
export function failure(error: unknown, stage: OutputFailure['stage'], root: string, outputSet?: string): OutputFailure {
  const problem = outputError(error, root);
  return Object.freeze({ code: problem.code, message: problem.message, stage, root, path: problem.path,
    ...(outputSet === undefined ? {} : { outputSet }) });
}
export function collide(left: OutputPath, right: OutputPath): boolean {
  try { assertNoOutputCollisions([left, right]); return false; } catch { return true; }
}

async function desiredPaths(protection: CleanupProtection): Promise<readonly OutputPath[]> {
  if (protection.status !== 'complete') {
    throw new OutputError('CONFLICT', `Current destination protection is unavailable: ${protection.reason}`, 'output protection');
  }
  const paths: OutputPath[] = [];
  for (const destination of protection.destinations) {
    // Different current sets may target the same file in separate runs; all protect it.
    for (const relative of destination.paths) paths.push(...await inspectOutputPaths(destination.root, [relative]));
  }
  return paths;
}

function stamp(info: Awaited<ReturnType<typeof optionalStat>>): string | undefined {
  return info === undefined ? undefined : `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
}
type Observation = { path: OutputPath; state: 'retained' | 'eligible' | 'absent'; reason?: string };
async function observe(root: OutputRoot, record: OutputRecord, protection: CleanupProtection): Promise<Observation> {
  const desired = await desiredPaths(protection);
  const [target] = await inspectOutputPaths(root, [record.path]);
  if (desired.some(item => collide(target!, item))) return { path: target!, state: 'retained', reason: 'Still targeted by a current set.' };
  const before = await optionalStat(target!.path);
  if (before === undefined) return { path: target!, state: 'absent' };
  const hash = hashOutputBytes(await readFile(target!.path));
  const [afterPath] = await inspectOutputPaths(root, [record.path]);
  if (afterPath!.path !== target!.path || stamp(before) !== stamp(await optionalStat(target!.path))) {
    throw new OutputError('CONFLICT', 'Output changed during cleanup inspection.', target!.path);
  }
  if (hash !== record.sha256) throw new OutputError('CONFLICT', 'Obsolete output was edited; preserving it.', target!.path);
  return { path: target!, state: 'eligible' };
}

/** Internal held-lock phase. The coordinator owns the run-wide pruning gate and lock lifetime. */
export async function cleanupUnderLock(
  lock: OutputLock, projectId: string, outputSet: string, protection: CleanupProtection, apply: boolean
): Promise<CleanupResult> {
  return inspectCleanup({ root: lock.root, projectId, outputSet }, snapshotProtection(protection), apply, lock);
}

async function inspectCleanup(scope: CleanupScope, protection: CleanupProtection, apply: boolean, lock?: OutputLock): Promise<CleanupResult> {
  const { root, projectId, outputSet } = scope;
  const outcomes: CleanupOutcome[] = [];
  const errors: OutputFailure[] = [];
  const outcome = (value: Omit<CleanupOutcome, 'root' | 'outputSet'>) =>
    outcomes.push(Object.freeze({ root: root.path, outputSet, ...value }));
  const guard = async () => lock === undefined ? assertOutputUnlocked(root) : verifyOutputLock(lock);
  try {
    validateProducer(projectId, outputSet, root.path);
    await guard();
    await desiredPaths(protection);
    const loaded = await readOutputManifest(root, lock);
    if (loaded.status === 'missing') {
      outcome({ action: 'unavailable', reason: 'No manifest; ownership cannot be inferred.' });
      errors.push(failure(new OutputError('CONFLICT', 'No ownership evidence for cleanup.', root.path), 'cleanup', root.path, outputSet));
    } else {
      for (const record of loaded.manifest.outputs.filter(item => item.projectId === projectId && item.outputSet === outputSet)) {
        try {
          await guard();
          let observed = await observe(root, record, protection);
          await guard();
          if (!apply || observed.state === 'retained') {
            outcome({ path: record.path, action: observed.state, ...(observed.reason === undefined ? {} : { reason: observed.reason }) });
            continue;
          }
          // Revalidate evidence immediately before mutation, including current destination aliases.
          const current = await readOutputManifest(root, lock);
          const matching = current.status === 'present' && current.manifest.outputs.some(item => item.path === record.path
            && item.projectId === projectId && item.outputSet === outputSet && item.sha256 === record.sha256);
          if (!matching) throw new OutputError('CONFLICT', 'Ownership changed before cleanup.', observed.path.path);
          observed = await observe(root, record, protection);
          if (observed.state === 'retained') {
            outcome({ path: record.path, action: 'retained', reason: observed.reason! });
            continue;
          }
          await guard();
          if (observed.state === 'eligible') await unlink(observed.path.path);
          const action = observed.state === 'eligible' ? 'deleted' : 'record-removed';
          try {
            await persistOutputManifest(lock!, projectId, [], [record]);
            outcome({ path: record.path, action, tracked: true });
          } catch (error) {
            outcome({ path: record.path, action: observed.state === 'eligible' ? 'deleted' : 'absent', tracked: false });
            errors.push(failure(error, 'tracking', root.path, outputSet));
            break; // Tracking is uncertain; no further deletion in this scope.
          }
        } catch (error) {
          outcome({ path: record.path, action: 'retained', reason: outputError(error, root.path).message });
          errors.push(failure(error, 'cleanup', root.path, outputSet));
          // Lost coordination blocks every remaining mutation in this scope.
          if (error instanceof OutputError && error.code === 'LOCK_LOST') break;
        }
      }
    }
    // Detect manifest changes observed during an advisory assessment without creating coordination.
    const latest = await readOutputManifest(root, lock);
    if (!apply && JSON.stringify(latest) !== JSON.stringify(loaded)) {
      throw new OutputError('CONFLICT', 'Ownership changed during cleanup assessment.', root.path);
    }
    await guard();
  } catch (error) {
    outcome({ action: 'unavailable', reason: outputError(error, root.path).message });
    errors.push(failure(error, 'cleanup', root.path, outputSet));
  }
  return Object.freeze({ success: errors.length === 0, outcomes: Object.freeze(outcomes), errors: Object.freeze(errors) });
}

/** Read-only assessment, or explicit application to a supplied current/retired scope. */
export async function cleanupOutputs(scope: CleanupScope, protection: CleanupProtection, apply = false): Promise<CleanupResult> {
  const supplied = Object.freeze({ ...scope, root: snapshotRoot(scope.root) });
  const protections = snapshotProtection(protection);
  if (!apply) return inspectCleanup(supplied, protections, false);
  let lock: OutputLock | undefined;
  let result: CleanupResult;
  const errors: OutputFailure[] = [];
  try {
    validateProducer(supplied.projectId, supplied.outputSet, supplied.root.path);
    await desiredPaths(protections); // Invalid protection must not create a lock/directory.
    lock = await acquireOutputLock(supplied.root);
    result = await inspectCleanup(supplied, protections, true, lock);
  } catch (error) {
    result = { success: false, outcomes: [], errors: [failure(error, 'coordination', supplied.root.path, supplied.outputSet)] };
  } finally {
    if (lock !== undefined) {
      try { await releaseOutputLock(lock); } catch (error) { errors.push(failure(error, 'release', supplied.root.path, supplied.outputSet)); }
    }
  }
  return Object.freeze({ success: result.success && errors.length === 0, outcomes: Object.freeze([...result.outcomes]),
    errors: Object.freeze([...result.errors, ...errors]) });
}
