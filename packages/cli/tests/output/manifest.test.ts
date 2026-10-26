import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import type * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof fsPromises>();
  return { ...actual, rename: vi.fn(actual.rename), readFile: vi.fn(actual.readFile) };
});

import { acquireOutputLock, releaseOutputLock } from '../../src/runtime/output/lock.js';
import type { OutputLock } from '../../src/runtime/output/lock.js';
import { decodeOutputManifest, hashOutputBytes, persistOutputManifest, readOutputManifest } from '../../src/runtime/output/manifest.js';
import type { OutputRecord } from '../../src/runtime/output/manifest.js';
import { resolveOutputRoot } from '../../src/runtime/output/paths.js';

const producer = '0f671f2d-657d-4f3c-9a7d-d22f769c083a';
const other = '5a618b44-bdb6-4dcf-a5fd-8d1a1f61d293';
const bytes = new TextEncoder().encode('generated\n');
function record(overrides: Partial<OutputRecord> = {}): OutputRecord {
  return { projectId: producer, outputSet: 'docs', path: 'README.md', sha256: hashOutputBytes(bytes), ...overrides };
}
const encode = (outputs: readonly OutputRecord[]) => JSON.stringify({ version: 1, outputs });

describe('output manifests', () => {
  let dir: string;
  let filePath: string;
  const locks: OutputLock[] = [];
  beforeEach(async () => {
    vi.resetAllMocks(); dir = await mkdtemp(path.join(tmpdir(), 'stem-output-manifest-'));
    filePath = path.join(dir, '.stem/outputs.json');
  });
  afterEach(async () => {
    for (const lock of locks.splice(0)) await releaseOutputLock(lock).catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  });
  async function lockRoot() {
    const lock = await acquireOutputLock(await resolveOutputRoot(dir, '.', []));
    locks.push(lock); return lock;
  }

  it('round-trips empty and multi-producer records without changing caller values', () => {
    expect(decodeOutputManifest(encode([]))).toEqual({ version: 1, outputs: [] });
    const input = [record(), record({ projectId: other, path: 'other.md', outputSet: 'retired' })];
    const snapshot = encode(input);
    const decoded = decodeOutputManifest(snapshot);
    expect(decoded.outputs).toEqual(input);
    expect(Object.isFrozen(decoded.outputs)).toBe(true);
    expect(Object.isFrozen(decoded.outputs[0])).toBe(true);
    expect(encode(input)).toBe(snapshot);
  });

  it.each(['{', 'null', '[]', '{}', '{"version":"1","outputs":[]}', '{"version":1.5,"outputs":[]}',
    '{"version":1,"outputs":{}}', '{"version":1,"outputs":[],"typo":true}'])('rejects corrupt envelope %s', text => {
    expect(() => decodeOutputManifest(text)).toThrow(expect.objectContaining({ code: 'MANIFEST_CORRUPT' }));
  });

  it.each([0, 2, -1])('distinguishes unsupported version %i without interpreting its records', version => {
    expect(() => decodeOutputManifest(JSON.stringify({ version, futureShape: true }))).toThrow(expect.objectContaining({ code: 'MANIFEST_UNSUPPORTED' }));
  });

  it.each([
    { projectId: '' }, { projectId: producer.toUpperCase() }, { projectId: producer + '\n' },
    { projectId: producer.replace('-4f3c-', '-7f3c-') }, { projectId: null }, { outputSet: '' },
    { outputSet: 2 }, { path: '../escape' }, { path: 'a\\b' }, { path: '/abs' }, { path: 'a//b' },
    { sha256: 'A'.repeat(64) }, { sha256: '0'.repeat(63) }, { sha256: '0'.repeat(64) + '\n' },
    { extra: true }, { projectId: undefined }
  ])('rejects invalid record fields %j', overrides => {
    const text = JSON.stringify({ version: 1, outputs: [{ ...record(), ...overrides }] });
    expect(() => decodeOutputManifest(text)).toThrow(expect.objectContaining({ code: 'MANIFEST_CORRUPT' }));
  });

  it.each([['README.md', 'README.md'], ['README.md', 'readme.md'], ['docs', 'docs/a.md']])('rejects duplicate/conflicting records %j', (...paths) => {
    expect(() => decodeOutputManifest(encode(paths.map(p => record({ path: p }))))).toThrow(expect.objectContaining({ code: 'MANIFEST_CORRUPT' }));
  });

  it('hashes exact bytes including line endings and Unicode', () => {
    expect(hashOutputBytes(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashOutputBytes(new TextEncoder().encode('🌱\r\n'))).not.toBe(hashOutputBytes(new TextEncoder().encode('🌱\n')));
    expect(hashOutputBytes(new TextEncoder().encode('é'))).not.toBe(hashOutputBytes(new TextEncoder().encode('e\u0301')));
  });

  it('reads missing and valid state without creating files or repairing data', async () => {
    const root = await resolveOutputRoot(dir, '.', []);
    expect(await readOutputManifest(root)).toEqual({ status: 'missing' });
    expect(await readdir(dir)).toEqual([]);
    await mkdir(path.dirname(filePath));
    const original = ' \n' + encode([record()]) + '\n';
    await writeFile(filePath, original);
    expect(await readOutputManifest(root)).toMatchObject({ status: 'present', manifest: { outputs: [record()] } });
    expect(await readFile(filePath, 'utf8')).toBe(original);
    expect(await readdir(path.dirname(filePath))).toEqual(['outputs.json']);
  });

  it.each([['{', 'MANIFEST_CORRUPT'], ['{"version":2}', 'MANIFEST_UNSUPPORTED']])('preserves invalid manifests during reads and persistence: %s', async (text, code) => {
    await mkdir(path.dirname(filePath)); await writeFile(filePath, text);
    const root = await resolveOutputRoot(dir, '.', []);
    await expect(readOutputManifest(root)).rejects.toMatchObject({ code });
    const lock = await lockRoot();
    await expect(persistOutputManifest(lock, producer, [record()])).rejects.toMatchObject({ code });
    expect(await readFile(filePath, 'utf8')).toBe(text);
  });

  it('rejects invalid UTF-8 and filesystem-invalid ownership evidence without repair', async () => {
    await mkdir(path.dirname(filePath)); await writeFile(filePath, new Uint8Array([0xff, 0xfe]));
    const root = await resolveOutputRoot(dir, '.', []);
    await expect(readOutputManifest(root)).rejects.toMatchObject({ code: 'MANIFEST_CORRUPT' });
    expect(await readFile(filePath)).toEqual(Buffer.from([0xff, 0xfe]));
    await writeFile(filePath, encode([record({ path: '.stem/config.json' })]));
    await expect(readOutputManifest(root)).rejects.toMatchObject({ code: 'INVALID_PATH' });
    expect(await readFile(filePath, 'utf8')).toBe(encode([record({ path: '.stem/config.json' })]));
  });

  it('detects an active writer and inconsistent read observations', async () => {
    const lock = await lockRoot();
    await expect(readOutputManifest(lock.root)).rejects.toMatchObject({ code: 'LOCK_BUSY' });
    await releaseOutputLock(lock); locks.pop();
    await writeFile(filePath, encode([]));
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    vi.mocked(readFile).mockImplementationOnce(async () => {
      const old = await actual.readFile(filePath);
      await actual.writeFile(filePath, encode([record()]));
      return old;
    });
    await expect(readOutputManifest(lock.root)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await readFile(filePath, 'utf8')).toBe(encode([record()]));
  });

  it('distinguishes I/O failure from a missing manifest', async () => {
    await mkdir(path.dirname(filePath)); await writeFile(filePath, encode([]));
    vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    await expect(readOutputManifest(await resolveOutputRoot(dir, '.', []))).rejects.toMatchObject({ code: 'IO_ERROR' });
    expect(await readFile(filePath, 'utf8')).toBe(encode([]));
  });

  it('requires a live lock and preserves other producers and untouched records', async () => {
    const lock = await lockRoot();
    const retained = record({ projectId: other, path: 'other.md', outputSet: 'retired' });
    await writeFile(filePath, encode([retained, record({ path: 'untouched.md' })]));
    const result = await persistOutputManifest(lock, producer, [record()]);
    expect(result.outputs).toEqual([retained, record({ path: 'untouched.md' }), record()]);
    await expect(persistOutputManifest(lock, producer, [record({ path: 'other.md' })])).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(persistOutputManifest(lock, producer, [retained])).rejects.toMatchObject({ code: 'CONFLICT' });
    const updated = record({ outputSet: 'new-set', sha256: 'a'.repeat(64) });
    expect((await persistOutputManifest(lock, producer, [updated])).outputs).toEqual([retained, record({ path: 'untouched.md' }), updated]);
    await releaseOutputLock(lock); locks.pop();
    await expect(persistOutputManifest(lock, producer, [record()])).rejects.toMatchObject({ code: 'LOCK_LOST' });
  });

  it('snapshots inputs and refuses concurrent updates through the same lock', async () => {
    const lock = await lockRoot();
    const mutable = { ...record() };
    const pending = persistOutputManifest(lock, producer, [mutable]);
    mutable.path = 'mutated.md';
    await expect(persistOutputManifest(lock, producer, [record({ path: 'second.md' })])).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await pending).outputs).toEqual([record()]);
  });

  it('preserves the old manifest on failed replacement and leaves published output intact', async () => {
    const lock = await lockRoot();
    const original = encode([record({ path: 'old.md' })]);
    await writeFile(filePath, original);
    await writeFile(path.join(dir, 'README.md'), bytes);
    vi.mocked(rename).mockRejectedValueOnce(Object.assign(new Error('failed replace'), { code: 'EPERM' }));
    await expect(persistOutputManifest(lock, producer, [record()])).rejects.toMatchObject({ code: 'IO_ERROR', message: expect.stringContaining('not been rolled back') as unknown });
    expect(await readFile(filePath, 'utf8')).toBe(original);
    expect(await readFile(path.join(dir, 'README.md'))).toEqual(Buffer.from(bytes));
    expect((await readdir(path.dirname(filePath))).sort()).toEqual(['outputs.json', 'outputs.lock']);
    // Failed persistence does not poison the held lock or block an explicit retry.
    expect((await persistOutputManifest(lock, producer, [record()])).outputs).toHaveLength(2);
  });

  it('removes only exact absent ownership records and preserves unrelated inventory', async () => {
    const lock = await lockRoot();
    const absent = record({ path: 'gone.md' });
    const retained = record({ projectId: other, path: 'theirs.md' });
    await writeFile(filePath, encode([absent, retained]));
    expect((await persistOutputManifest(lock, producer, [record()], [absent])).outputs).toEqual([retained, record()]);
  });

  it('rejects stale, foreign, present and overlapping removal requests without rewriting evidence', async () => {
    const lock = await lockRoot();
    const existing = record();
    const foreign = record({ projectId: other, path: 'foreign.md' });
    const original = encode([existing, foreign]);
    await writeFile(filePath, original);
    for (const removal of [record({ sha256: 'a'.repeat(64) }), record({ outputSet: 'changed' }), foreign, record({ path: 'unknown.md' })]) {
      await expect(persistOutputManifest(lock, producer, [], [removal])).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    await expect(persistOutputManifest(lock, producer, [existing], [existing])).rejects.toMatchObject({ code: 'CONFLICT' });
    await writeFile(path.join(dir, 'README.md'), 'recreated');
    await expect(persistOutputManifest(lock, producer, [], [existing])).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await readFile(filePath, 'utf8')).toBe(original);
  });

  it('snapshots removal evidence and preserves it on persistence failure', async () => {
    const lock = await lockRoot();
    await writeFile(filePath, encode([record()]));
    const mutable = { ...record() };
    const pending = persistOutputManifest(lock, producer, [], [mutable]);
    mutable.path = 'caller-mutated.md';
    expect((await pending).outputs).toEqual([]);
    await writeFile(filePath, encode([record()]));
    vi.mocked(rename).mockRejectedValueOnce(new Error('cannot persist'));
    await expect(persistOutputManifest(lock, producer, [], [record()])).rejects.toMatchObject({ code: 'IO_ERROR' });
    expect(await readFile(filePath, 'utf8')).toBe(encode([record()]));
  });
});
