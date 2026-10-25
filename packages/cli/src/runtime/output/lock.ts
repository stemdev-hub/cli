import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';

import { hasCode, inspectBookkeepingPath, optionalStat, OutputError, outputError } from './paths.js';
import type { OutputRoot } from './paths.js';

export interface OutputLock { readonly root: OutputRoot }
interface Ownership { path: string; token: string; identity: string; file: FileHandle }
const owners = new WeakMap<OutputLock, Ownership>();

/** No polling or stale-lock recovery. A failed acquisition never unlinks the existing entry. */
export async function acquireOutputLock(root: OutputRoot): Promise<OutputLock> {
  const lockPath = await inspectBookkeepingPath(root, 'outputs.lock');
  const token = randomUUID();
  let file: FileHandle;
  try {
    await mkdir(path.dirname(lockPath), { recursive: true });
    if (await inspectBookkeepingPath(root, 'outputs.lock') !== lockPath) throw new OutputError('INVALID_PATH', 'Lock path changed.', lockPath);
    file = await open(lockPath, 'wx');
  } catch (error) {
    if (hasCode(error, 'EEXIST')) throw new OutputError('LOCK_BUSY', 'Output root already has a writer lock.', lockPath, error);
    throw outputError(error, lockPath);
  }
  let identity: string | undefined;
  let initialized = false;
  try {
    const info = await file.stat({ bigint: true });
    identity = `${info.dev}:${info.ino}`;
    await file.writeFile(token, 'utf8');
    initialized = true;
    const lock = Object.freeze({ root });
    owners.set(lock, { path: lockPath, token, identity, file });
    await verifyOutputLock(lock);
    return lock;
  } catch (error) {
    // Remove an incompletely initialized entry only when its acquired file identity still matches.
    // If even that evidence could not be established, preserve the entry for explicit recovery.
    try { await file.close(); } catch { /* Original failure remains primary. */ }
    try {
      const current = await inspectBookkeepingPath(root, 'outputs.lock');
      const info = await optionalStat(current);
      if (current === lockPath && identity !== undefined && info !== undefined && `${info.dev}:${info.ino}` === identity
        && (!initialized || await readFile(current, 'utf8') === token)) {
        await unlink(current);
      }
    } catch { /* Retain a leftover lock when safe cleanup cannot be confirmed. */ }
    throw new OutputError('IO_ERROR', 'Failed to initialize output lock; inspect any remaining entry before recovery.', lockPath, error);
  }
}

export async function verifyOutputLock(lock: OutputLock): Promise<void> {
  const owner = owners.get(lock);
  if (owner === undefined) throw new OutputError('LOCK_LOST', 'Output lock is not owned by this invocation.', lock.root.path);
  try {
    const current = await inspectBookkeepingPath(lock.root, 'outputs.lock');
    const info = await optionalStat(current);
    if (current !== owner.path || info === undefined || `${info.dev}:${info.ino}` !== owner.identity
      || await readFile(current, 'utf8') !== owner.token) {
      throw new OutputError('LOCK_LOST', 'Output lock ownership changed.', owner.path);
    }
  } catch (error) {
    throw new OutputError('LOCK_LOST', 'Cannot verify output lock ownership.', owner.path, error);
  }
}

export async function releaseOutputLock(lock: OutputLock): Promise<void> {
  const owner = owners.get(lock);
  if (owner === undefined) throw new OutputError('LOCK_LOST', 'Output lock is not owned by this invocation.', lock.root.path);
  try {
    await verifyOutputLock(lock);
    await owner.file.close();
    await verifyOutputLock(lock);
    await unlink(owner.path);
  } catch (error) {
    try { await owner.file.close(); } catch { /* Report the release failure, not a secondary close. */ }
    throw new OutputError('LOCK_RELEASE_FAILED', 'Failed to release output lock; inspect the remaining entry before recovery.', owner.path, error);
  } finally {
    owners.delete(lock);
  }
}

/** Advisory reads never acquire a lock or create its parent directory. */
export async function assertOutputUnlocked(root: OutputRoot): Promise<void> {
  const lockPath = await inspectBookkeepingPath(root, 'outputs.lock');
  try {
    if (await optionalStat(lockPath) !== undefined) throw new OutputError('LOCK_BUSY', 'Cannot assess output state while a writer lock exists.', lockPath);
  } catch (error) { throw outputError(error, lockPath); }
}
