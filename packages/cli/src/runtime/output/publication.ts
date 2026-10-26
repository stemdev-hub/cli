import path from 'node:path';
import { writeFile } from '../fs/writer.js';
import { acquireOutputLock, releaseOutputLock, verifyOutputLock } from './lock.js';
import type { OutputLock } from './lock.js';
import { hashOutputBytes, persistOutputManifest, readOutputManifest } from './manifest.js';
import type { OutputRecord } from './manifest.js';
import { assertNoOutputCollisions, inspectOutputPaths, optionalStat, OutputError, outputError, revalidateOutputRoot } from './paths.js';
import type { OutputPath, OutputRoot } from './paths.js';
import { cleanupUnderLock, collide, failure, snapshotProtection, snapshotRoot, validateProducer } from './cleanup.js';
import type { CleanupOutcome, CleanupProtection, OutputFailure } from './cleanup.js';

export interface PreparedTarget {
  readonly path: string;
  /** Eligibility/composition belongs to the caller. A failed preparation cannot publish bytes. */
  readonly prepared: { readonly status: 'ready'; readonly content: string }
    | { readonly status: 'failed'; readonly code: string; readonly message: string };
}
export interface PreparedOutputSet {
  readonly name: string;
  readonly root: OutputRoot;
  readonly ifExists: 'replace' | 'skip' | 'error';
  readonly cleanup: 'keep' | 'prune';
  readonly complete: boolean;
  readonly targets: readonly PreparedTarget[];
}
export interface PublicationTarget {
  readonly root: string;
  readonly outputSet: string;
  readonly path: string;
  readonly status: 'published' | 'skipped' | 'not-published';
  readonly tracking: 'unchanged' | 'persisted' | 'failed';
  readonly reason?: string;
}
export interface PublicationResult {
  readonly success: boolean;
  readonly targets: readonly PublicationTarget[];
  readonly cleanup: readonly CleanupOutcome[];
  readonly errors: readonly OutputFailure[];
}
interface TargetWork { set: PreparedOutputSet; target: PreparedTarget; destination: OutputPath; index: number }
interface RootWork {
  root: OutputRoot;
  sets: PreparedOutputSet[];
  targets: TargetWork[];
  lock?: OutputLock;
  records?: readonly OutputRecord[];
}
const rootKey = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;

/**
 * Private prepared-output phase: no parser, configuration discovery or public command bridge.
 * Inputs are copied before awaiting. The caller supplies all current destination protections;
 * unavailable protection permits publication but never authorizes cleanup.
 */
export async function publishOutputs(
  projectId: string, supplied: readonly PreparedOutputSet[], protection: CleanupProtection
): Promise<PublicationResult> {
  const targets: PublicationTarget[] = [];
  const cleanup: CleanupOutcome[] = [];
  const errors: OutputFailure[] = [];
  const roots = new Map<string, RootWork>();
  const finish = (): PublicationResult => Object.freeze({ success: errors.length === 0,
    targets: Object.freeze(targets.map(item => Object.freeze(item))),
    cleanup: Object.freeze(cleanup.map(item => Object.freeze(item))), errors: Object.freeze(errors) });
  let sets: readonly PreparedOutputSet[];
  let protections: CleanupProtection;
  try {
    sets = supplied.map(set => ({ ...set, root: snapshotRoot(set.root), targets: set.targets.map(target =>
      ({ ...target, prepared: { ...target.prepared } })) }));
    protections = snapshotProtection(protection);
    // Reuse the pure identity validator even for a valid empty selection.
    if (sets.length === 0) {
      // No root is needed for an error's context; validation performs no filesystem work.
      validateProducer(projectId, 'empty selection', '');
      return finish();
    }
    const names = new Set<string>();
    for (const set of sets) {
      validateProducer(projectId, set.name, set.root.path);
      if (names.has(set.name) || !['replace', 'skip', 'error'].includes(set.ifExists)
        || !['keep', 'prune'].includes(set.cleanup) || typeof set.complete !== 'boolean') {
        throw new OutputError('CONFLICT', 'Duplicate set or invalid publication policy/selection.', set.root.path);
      }
      names.add(set.name);
      for (const target of set.targets) {
        if (target.prepared.status === 'ready' ? typeof target.prepared.content !== 'string'
          : target.prepared.status !== 'failed' || typeof target.prepared.code !== 'string' || typeof target.prepared.message !== 'string') {
          throw new OutputError('CONFLICT', 'Invalid prepared output.', target.path);
        }
        targets.push({ root: set.root.path, outputSet: set.name, path: target.path,
          status: 'not-published', tracking: 'unchanged', reason: 'Publication has not been attempted.' });
      }
    }
    // All roots share source/config protections; each retains its original alias for revalidation.
    const sharedProtections = sets.flatMap(set => [...set.root.protectedPaths, path.join(set.root.projectRoot, '.git'),
      path.join(set.root.projectRoot, '.stem/config.json')]);
    sets = sets.map(set => ({ ...set, root: snapshotRoot({ ...set.root, protectedPaths: sharedProtections }) }));
    if (protections.status === 'complete') protections = snapshotProtection({ status: 'complete',
      destinations: [...protections.destinations, ...sets.map(set => ({ root: set.root, paths: set.targets.map(target => target.path) }))] });
    let index = 0;
    for (const set of sets) {
      const key = rootKey(set.root.path);
      let group = roots.get(key);
      if (group === undefined) {
        group = { root: set.root, sets: [], targets: [] }; roots.set(key, group);
      }
      group.sets.push(set);
      const inspected = await inspectOutputPaths(set.root, set.targets.map(target => target.path));
      for (let i = 0; i < set.targets.length; i++) group.targets.push({ set, target: set.targets[i]!, destination: inspected[i]!, index: index++ });
    }
    const all = [...roots.values()].flatMap(root => root.targets.map(target => target.destination));
    assertNoOutputCollisions(all);
    // A target in an ancestor root cannot overwrite another selected root's bookkeeping.
    for (const root of roots.values()) for (const destination of all) {
      if (collide(destination, { path: path.join(root.root.path, '.stem'), identity: undefined })) {
        throw new OutputError('CONFLICT', 'Target conflicts with selected-root bookkeeping.', destination.path);
      }
    }
  } catch (error) {
    errors.push(failure(error, 'planning', ''));
    for (let i = 0; i < targets.length; i++) targets[i] = { ...targets[i]!, reason: 'Selected publication plan is invalid.' };
    return finish();
  }

  const ordered = [...roots.values()].sort((a, b) => rootKey(a.root.path) < rootKey(b.root.path) ? -1 : 1);
  const rootGuard = async (group: RootWork) => {
    for (const set of group.sets) await revalidateOutputRoot(set.root);
    await verifyOutputLock(group.lock!);
  };
  const blockRoot = (group: RootWork, reason: string) => {
    for (const work of group.targets) if (targets[work.index]!.status === 'not-published') {
      targets[work.index] = { ...targets[work.index]!, reason };
    }
  };
  try {
    // Authoritative reads of all usable roots precede writes, so known cross-root ownership is visible.
    for (const group of ordered) {
      try {
        for (const set of group.sets) await revalidateOutputRoot(set.root);
        group.lock = await acquireOutputLock(group.root);
        const loaded = await readOutputManifest(group.root, group.lock);
        group.records = loaded.status === 'present' ? loaded.manifest.outputs : [];
      } catch (error) {
        errors.push(failure(error, 'coordination', group.root.path));
        blockRoot(group, outputError(error, group.root.path).message);
      }
    }
    // Repeat the global collision check under acquired coordination before the first publication.
    try {
      const current: OutputPath[] = [];
      for (const group of ordered) for (const set of group.sets) {
        current.push(...await inspectOutputPaths(set.root, set.targets.map(target => target.path)));
      }
      assertNoOutputCollisions(current);
      for (const group of ordered) for (const destination of current) {
        if (collide(destination, { path: path.join(group.root.path, '.stem'), identity: undefined })) {
          throw new OutputError('CONFLICT', 'Destination changed into selected-root bookkeeping.', destination.path);
        }
      }
    } catch (error) {
      errors.push(failure(error, 'planning', ''));
      for (const group of ordered) { delete group.records; blockRoot(group, 'Selected plan changed before publication.'); }
    }
    const known: { root: RootWork; record: OutputRecord; destination: OutputPath }[] = [];
    for (const group of ordered) {
      if (group.records === undefined) continue;
      try {
        const paths = await inspectOutputPaths(group.root, group.records.map(record => record.path));
        group.records.forEach((record, i) => known.push({ root: group, record, destination: paths[i]! }));
      } catch (error) {
        delete group.records;
        errors.push(failure(error, 'coordination', group.root.path));
        blockRoot(group, outputError(error, group.root.path).message);
      }
    }
    for (const group of ordered) {
      if (group.lock === undefined || group.records === undefined) continue;
      const writes: OutputRecord[] = [];
      const published: number[] = [];
      for (const work of group.targets) {
        const { set, target, index } = work;
        try {
          await rootGuard(group);
          const [destination] = await inspectOutputPaths(set.root, [target.path]);
          if (destination!.path !== work.destination.path) throw new OutputError('CONFLICT', 'Destination alias changed after planning.', destination!.path);
          for (const owner of known) {
            if (collide(destination!, owner.destination)
              && !(owner.root === group && owner.record.path === target.path && owner.record.projectId === projectId)) {
              throw new OutputError('CONFLICT', 'Destination conflicts with recorded ownership.', destination!.path);
            }
          }
          const exists = await optionalStat(destination!.path) !== undefined;
          if (exists && set.ifExists === 'error') throw new OutputError('CONFLICT', 'Output already exists.', destination!.path);
          if (exists && set.ifExists === 'skip') {
            targets[index] = { ...targets[index]!, status: 'skipped', reason: 'Existing file preserved; freshness is unknown.' };
            continue;
          }
          if (target.prepared.status === 'failed') {
            errors.push(Object.freeze({ code: target.prepared.code, message: target.prepared.message,
              stage: 'preparation', root: group.root.path, outputSet: set.name, path: target.path }));
            targets[index] = { ...targets[index]!, reason: target.prepared.message }; continue;
          }
          await rootGuard(group);
          const written = await writeFile(destination!.path, target.prepared.content, { overwrite: set.ifExists === 'replace' });
          if (!written.success) {
            if (written.error.code === 'ALREADY_EXISTS' && set.ifExists === 'skip') {
              await rootGuard(group);
              await inspectOutputPaths(set.root, [target.path]);
              targets[index] = { ...targets[index]!, status: 'skipped', reason: 'File appeared during preparation; preserved without adoption.' };
              continue;
            }
            throw new OutputError(written.error.code === 'ALREADY_EXISTS' ? 'CONFLICT' : 'IO_ERROR', written.error.message, written.error.path);
          }
          targets[index] = { root: group.root.path, outputSet: set.name, path: target.path, status: 'published', tracking: 'failed' };
          published.push(index);
          writes.push({ projectId, outputSet: set.name, path: target.path, sha256: hashOutputBytes(new TextEncoder().encode(target.prepared.content)) });
        } catch (error) {
          errors.push(failure(error, 'publication', group.root.path, set.name));
          targets[index] = { ...targets[index]!, reason: outputError(error, group.root.path).message };
          if (error instanceof OutputError && error.code === 'LOCK_LOST') { blockRoot(group, error.message); break; }
        }
      }
      if (writes.length > 0) {
        try {
          await rootGuard(group);
          await persistOutputManifest(group.lock, projectId, writes);
          for (const index of published) targets[index] = { ...targets[index]!, tracking: 'persisted' };
        } catch (error) { errors.push(failure(error, 'tracking', group.root.path)); }
      }
    }
    // Verify every held lock before opening the run-wide automatic-pruning gate.
    for (const group of ordered) if (group.lock !== undefined) {
      try { await rootGuard(group); } catch (error) { errors.push(failure(error, 'coordination', group.root.path)); }
    }
    const publicationFailed = errors.length > 0;
    for (const group of ordered) {
      for (const set of group.sets) {
        const suppress = (reason: string) => cleanup.push({ root: group.root.path, outputSet: set.name, action: 'suppressed', reason });
        if (group.lock === undefined || group.records === undefined) { suppress('Output root is unavailable.'); continue; }
        if (set.cleanup === 'prune' && (publicationFailed || !set.complete || errors.length > 0)) {
          suppress(!set.complete ? 'Partial-set selection never prunes.' : 'Run failures suppress automatic pruning.'); continue;
        }
        try {
          await rootGuard(group);
          const manifest = await readOutputManifest(group.root, group.lock);
          if (manifest.status === 'missing') {
            cleanup.push({ root: group.root.path, outputSet: set.name, action: 'unavailable', reason: 'No ownership evidence; no cleanup attempted.' });
            continue;
          }
          // Ownership observed in another selected root is protection, never permission to delete.
          const cleanupProtection = protections.status === 'complete' ? { status: 'complete' as const,
            destinations: [...protections.destinations, ...known.filter(owner => owner.root !== group).map(owner =>
              ({ root: owner.root.root, paths: [owner.record.path] }))] } : protections;
          const result = await cleanupUnderLock(group.lock, projectId, set.name, cleanupProtection, set.cleanup === 'prune');
          cleanup.push(...result.outcomes); errors.push(...result.errors);
        } catch (error) { errors.push(failure(error, 'cleanup', group.root.path, set.name)); }
      }
    }
  } finally {
    for (const group of [...ordered].reverse()) if (group.lock !== undefined) {
      try { await releaseOutputLock(group.lock); } catch (error) { errors.push(failure(error, 'release', group.root.path)); }
    }
  }
  return finish();
}
