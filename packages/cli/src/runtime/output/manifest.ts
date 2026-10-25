import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { normalizeStemConfig } from '@stemdev/core';
import { writeFile } from '../fs/writer.js';
import { assertOutputUnlocked, verifyOutputLock } from './lock.js';
import type { OutputLock } from './lock.js';
import { assertNoOutputCollisions, inspectBookkeepingPath, inspectOutputPaths, isCanonicalOutputPath,
  optionalStat, OutputError, outputError } from './paths.js';
import type { OutputRoot } from './paths.js';

export interface OutputRecord {
  readonly projectId: string;
  readonly outputSet: string;
  readonly path: string;
  readonly sha256: string;
}
export interface OutputManifest { readonly version: 1; readonly outputs: readonly OutputRecord[] }
export type ManifestRead = { readonly status: 'missing' }
  | { readonly status: 'present'; readonly manifest: OutputManifest };
const persisting = new WeakSet<OutputLock>();

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
}
function validProjectId(value: unknown): value is string {
  return typeof value === 'string' && normalizeStemConfig({ projectId: value }, 'output manifest').success;
}

/** Pure decoding; never fixes records or normalizes identity/path/hash spelling. */
export function decodeOutputManifest(text: string): OutputManifest {
  const corrupt = (message: string) => new OutputError('MANIFEST_CORRUPT', message, 'outputs.json');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (error) {
    throw new OutputError('MANIFEST_CORRUPT', 'Output manifest is not valid JSON.', 'outputs.json', error);
  }
  if (!object(raw) || typeof raw['version'] !== 'number' || !Number.isInteger(raw['version'])) {
    throw corrupt('Output manifest needs an integer format version.');
  }
  if (raw['version'] !== 1) throw new OutputError('MANIFEST_UNSUPPORTED', 'Unsupported output manifest version.', 'outputs.json');
  if (!exactKeys(raw, ['version', 'outputs']) || !Array.isArray(raw['outputs'])) throw corrupt('Invalid output manifest envelope.');
  const outputs: OutputRecord[] = [];
  for (const value of raw['outputs'] as unknown[]) {
    if (!object(value) || !exactKeys(value, ['projectId', 'outputSet', 'path', 'sha256'])
      || !validProjectId(value['projectId']) || typeof value['outputSet'] !== 'string' || value['outputSet'].length === 0
      || !isCanonicalOutputPath(value['path']) || typeof value['sha256'] !== 'string'
      || value['sha256'].length !== 64 || !/^[0-9a-f]{64}$/.test(value['sha256'])) {
      throw corrupt('Invalid output ownership record.');
    }
    outputs.push(Object.freeze({ projectId: value['projectId'], outputSet: value['outputSet'], path: value['path'], sha256: value['sha256'] }));
  }
  try { assertNoOutputCollisions(outputs.map(record => ({ path: record.path, identity: undefined }))); }
  catch (error) { throw new OutputError('MANIFEST_CORRUPT', 'Output manifest contains conflicting destinations.', 'outputs.json', error); }
  return Object.freeze({ version: 1, outputs: Object.freeze(outputs) });
}

export function hashOutputBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function stamp(info: Awaited<ReturnType<typeof optionalStat>>): string | undefined {
  return info === undefined ? undefined : `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
}

/** Without a lock this is an advisory, write-free read; observed contention is an error. */
export async function readOutputManifest(root: OutputRoot, lock?: OutputLock): Promise<ManifestRead> {
  const guard = async () => {
    if (lock === undefined) await assertOutputUnlocked(root);
    else {
      if (lock.root !== root) throw new OutputError('LOCK_LOST', 'Lock belongs to another output context.', root.path);
      await verifyOutputLock(lock);
    }
  };
  try {
    await guard();
    const filePath = await inspectBookkeepingPath(root, 'outputs.json');
    const before = stamp(await optionalStat(filePath));
    let result: ManifestRead = { status: 'missing' };
    if (before !== undefined) {
      const bytes = await readFile(filePath);
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (error) { throw new OutputError('MANIFEST_CORRUPT', 'Output manifest is not valid UTF-8.', filePath, error); }
      let manifest: OutputManifest;
      try { manifest = decodeOutputManifest(text); }
      catch (error) {
        if (error instanceof OutputError) throw new OutputError(error.code, error.message, filePath, error);
        throw error;
      }
      await inspectOutputPaths(root, manifest.outputs.map(record => record.path));
      result = { status: 'present', manifest };
    }
    await guard();
    if (await inspectBookkeepingPath(root, 'outputs.json') !== filePath || stamp(await optionalStat(filePath)) !== before) {
      throw new OutputError('CONFLICT', 'Output manifest changed during inspection.', filePath);
    }
    return Object.freeze(result);
  } catch (error) { throw outputError(error, root.path); }
}

/**
 * Record only writes the caller has confirmed as published. This does not publish output files
 * or adopt skipped files. Other producers and untouched records are retained; deletion is outside
 * this checkpoint. The caller keeps the lock until the entire publication/cleanup run is done.
 */
export async function persistOutputManifest(
  lock: OutputLock, projectId: string, confirmedWrites: readonly OutputRecord[]
): Promise<OutputManifest> {
  if (persisting.has(lock)) throw new OutputError('CONFLICT', 'A manifest update is already using this lock.', lock.root.path);
  persisting.add(lock);
  try {
    if (!validProjectId(projectId)) throw new OutputError('MANIFEST_CORRUPT', 'Invalid producer identity.', lock.root.path);
    // Validate/copy before the first await that could expose caller mutation of the records.
    const updates = decodeOutputManifest(JSON.stringify({ version: 1, outputs: confirmedWrites })).outputs;
    await verifyOutputLock(lock);
    if (updates.some(record => record.projectId !== projectId)) {
      throw new OutputError('CONFLICT', 'Cannot record another producer\'s writes.', lock.root.path);
    }
    const previous = await readOutputManifest(lock.root, lock);
    const records = new Map((previous.status === 'present' ? previous.manifest.outputs : []).map(record => [record.path, record]));
    for (const record of updates) {
      const existing = records.get(record.path);
      if (existing !== undefined && existing.projectId !== projectId) {
        throw new OutputError('CONFLICT', 'Output belongs to another producer.', record.path);
      }
      records.set(record.path, record);
    }
    const manifest = decodeOutputManifest(JSON.stringify({ version: 1, outputs: [...records.values()] }));
    await inspectOutputPaths(lock.root, manifest.outputs.map(record => record.path));
    const filePath = await inspectBookkeepingPath(lock.root, 'outputs.json');
    await verifyOutputLock(lock);
    const written = await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, { overwrite: previous.status === 'present' });
    if (!written.success) throw new OutputError('IO_ERROR', 'Failed to persist output ownership; published files have not been rolled back.', filePath, written.error);
    return manifest;
  } catch (error) { throw outputError(error, lock.root.path); }
  finally { persisting.delete(lock); }
}
