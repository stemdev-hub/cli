import { mkdir, mkdtemp, open, readFile, readdir, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import type * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, readFile: vi.fn(actual.readFile), unlink: vi.fn(actual.unlink), rename: vi.fn(actual.rename),
    mkdir: vi.fn(actual.mkdir), open: vi.fn(actual.open) };
});
import { cleanupOutputs } from '../../src/runtime/output/cleanup.js';
import type { CleanupProtection, CleanupScope } from '../../src/runtime/output/cleanup.js';
import { hashOutputBytes } from '../../src/runtime/output/manifest.js';
import type { OutputRecord } from '../../src/runtime/output/manifest.js';
import { resolveOutputRoot } from '../../src/runtime/output/paths.js';
import { acquireOutputLock, releaseOutputLock } from '../../src/runtime/output/lock.js';

const producer = '0f671f2d-657d-4f3c-9a7d-d22f769c083a';
const other = '5a618b44-bdb6-4dcf-a5fd-8d1a1f61d293';
const empty: CleanupProtection = { status: 'complete', destinations: [] };
const record = (file = 'old.md', content = 'old\r\n', overrides: Partial<OutputRecord> = {}): OutputRecord =>
  ({ projectId: producer, outputSet: 'retired', path: file, sha256: hashOutputBytes(new TextEncoder().encode(content)), ...overrides });

describe('selective output cleanup', () => {
  let dir: string;
  let scope: CleanupScope;
  const manifestPath = () => path.join(dir, '.stem/outputs.json');
  beforeEach(async () => {
    vi.resetAllMocks(); dir = await mkdtemp(path.join(tmpdir(), 'stem-cleanup-'));
    scope = { root: await resolveOutputRoot(dir, '.', []), projectId: producer, outputSet: 'retired' };
  });
  afterEach(async () => { vi.resetAllMocks(); await rm(dir, { recursive: true, force: true }); });
  async function seed(records: readonly OutputRecord[] = [record()]) {
    await mkdir(path.dirname(manifestPath()), { recursive: true });
    await writeFile(manifestPath(), JSON.stringify({ version: 1, outputs: records }));
  }
  async function inventory() { return JSON.parse(await readFile(manifestPath(), 'utf8')) as { outputs: OutputRecord[] }; }
  async function old() { await writeFile(path.join(dir, 'old.md'), 'old\r\n'); await seed(); }

  it('assesses eligible and absent files without writing any state', async () => {
    await old(); await seed([record(), record('absent.md')]);
    const before = await readFile(manifestPath());
    vi.mocked(mkdir).mockClear(); vi.mocked(open).mockClear();
    const result = await cleanupOutputs(scope, empty);
    expect(result).toMatchObject({ success: true, outcomes: [{ action: 'eligible' }, { action: 'absent' }] });
    expect(await readFile(manifestPath())).toEqual(before);
    expect(await readFile(path.join(dir, 'old.md'), 'utf8')).toBe('old\r\n');
    expect(await readdir(path.join(dir, '.stem'))).toEqual(['outputs.json']);
    expect(unlink).not.toHaveBeenCalled(); expect(rename).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  });
  it('does not create a missing output directory or interpret missing ownership as an empty inventory', async () => {
    const root = await resolveOutputRoot(dir, 'missing/nested', []);
    const result = await cleanupOutputs({ ...scope, root }, empty);
    expect(result).toMatchObject({ success: false, outcomes: [{ action: 'unavailable' }] });
    expect(await readdir(dir)).toEqual([]);
  });
  it('applies retired-scope cleanup, removes absent records and preserves unrelated producers/sets/files', async () => {
    await old();
    const retained = [record('other.md', 'other', { projectId: other }), record('another-set.md', 'other', { outputSet: 'current' })];
    await seed([record(), record('absent.md'), ...retained]);
    await writeFile(path.join(dir, 'untracked.md'), 'old\r\n');
    const result = await cleanupOutputs(scope, empty, true);
    expect(result).toMatchObject({ success: true, outcomes: [{ action: 'deleted', tracked: true }, { action: 'record-removed', tracked: true }] });
    expect((await inventory()).outputs).toEqual(retained);
    expect(await readFile(path.join(dir, 'untracked.md'), 'utf8')).toBe('old\r\n');
    await expect(readFile(path.join(dir, 'old.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(path.join(dir, '.stem'))).toEqual(['outputs.json']);
  });
  it.each([false, true])('protects a current target in another root and set (apply=%s)', async apply => {
    await mkdir(path.join(dir, 'nested')); await writeFile(path.join(dir, 'nested/old.md'), 'old\r\n');
    await seed([record('nested/old.md')]);
    const nested = await resolveOutputRoot(dir, 'nested', []);
    const result = await cleanupOutputs(scope, { status: 'complete', destinations: [{ root: nested, paths: ['old.md', 'old.md'] }] }, apply);
    expect(result).toMatchObject({ success: true, outcomes: [{ action: 'retained' }] });
    expect((await inventory()).outputs).toHaveLength(1);
  });
  it.each([false, true])('preserves edited files including line-ending changes (apply=%s)', async apply => {
    await old(); await writeFile(path.join(dir, 'old.md'), 'old\n');
    const before = await readFile(manifestPath());
    const result = await cleanupOutputs(scope, empty, apply);
    expect(result).toMatchObject({ success: false, outcomes: [{ action: 'retained' }], errors: [{ code: 'CONFLICT' }] });
    expect(await readFile(manifestPath())).toEqual(before);
    expect(await readFile(path.join(dir, 'old.md'), 'utf8')).toBe('old\n');
  });
  it.each([false, true])('blocks missing protection rather than treating it as no current targets (apply=%s)', async apply => {
    const result = await cleanupOutputs(scope, { status: 'unavailable', reason: 'invalid current configuration' }, apply);
    expect(result.success).toBe(false); expect(await readdir(dir)).toEqual([]);
  });
  it('blocks unresolved protection paths before applying any deletion', async () => {
    await old();
    const result = await cleanupOutputs(scope, { status: 'complete', destinations: [{ root: scope.root, paths: ['../bad'] }] }, true);
    expect(result.success).toBe(false);
    expect(await readFile(path.join(dir, 'old.md'), 'utf8')).toBe('old\r\n');
    expect(await readdir(path.join(dir, '.stem'))).toEqual(['outputs.json']);
  });
  it.each(['{', '{"version":2}'])('preserves corrupt or unsupported ownership %s', async text => {
    await old(); await writeFile(manifestPath(), text);
    const result = await cleanupOutputs(scope, empty, true);
    expect(result.success).toBe(false); expect(await readFile(manifestPath(), 'utf8')).toBe(text);
    expect(await readFile(path.join(dir, 'old.md'), 'utf8')).toBe('old\r\n');
  });
  it('refuses a protected source alias in the recorded destination', async () => {
    await mkdir(path.join(dir, 'source')); await writeFile(path.join(dir, 'source/old.md'), 'old\r\n');
    await symlink(path.join(dir, 'source'), path.join(dir, 'alias'), 'junction');
    await seed([record('alias/old.md')]);
    const root = await resolveOutputRoot(dir, '.', [path.join(dir, 'source')]);
    expect((await cleanupOutputs({ ...scope, root }, empty, true)).success).toBe(false);
    expect(await readFile(path.join(dir, 'source/old.md'), 'utf8')).toBe('old\r\n');
  });
  it('reports contention without stealing or removing another invocation\'s lock', async () => {
    await old(); const lock = await acquireOutputLock(scope.root);
    try {
      const token = await readFile(path.join(dir, '.stem/outputs.lock'));
      for (const apply of [false, true]) expect((await cleanupOutputs(scope, empty, apply)).success).toBe(false);
      expect(await readFile(path.join(dir, '.stem/outputs.lock'))).toEqual(token);
    } finally { await releaseOutputLock(lock); }
  });
  it('preserves the record on deletion failure', async () => {
    await old(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(unlink).mockImplementation(async file => {
      if (String(file).endsWith('old.md')) throw Object.assign(new Error('denied'), { code: 'EACCES' });
      return actual.unlink(file);
    });
    const result = await cleanupOutputs(scope, empty, true);
    expect(result).toMatchObject({ success: false, outcomes: [{ action: 'retained' }], errors: [{ stage: 'cleanup' }] });
    expect((await inventory()).outputs).toHaveLength(1);
  });
  it('retains confirmed deletion evidence when tracking fails and stops further deletion', async () => {
    await old(); await writeFile(path.join(dir, 'next.md'), 'old\r\n'); await seed([record(), record('next.md')]);
    vi.mocked(rename).mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    const result = await cleanupOutputs(scope, empty, true);
    expect(result).toMatchObject({ success: false, outcomes: [{ action: 'deleted', tracked: false }], errors: [{ stage: 'tracking' }] });
    expect((await inventory()).outputs).toHaveLength(2);
    expect(await readFile(path.join(dir, 'next.md'), 'utf8')).toBe('old\r\n');
  });
  it('does not report an absent record as removed when persistence failed', async () => {
    await seed(); vi.mocked(rename).mockRejectedValueOnce(new Error('failed'));
    expect(await cleanupOutputs(scope, empty, true)).toMatchObject({ success: false, outcomes: [{ action: 'absent', tracked: false }] });
    expect((await inventory()).outputs).toHaveLength(1);
  });
  it('reports late release failure without undoing successful cleanup', async () => {
    await old(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(unlink).mockImplementation(async file => {
      if (String(file).endsWith('outputs.lock')) throw new Error('release failed');
      return actual.unlink(file);
    });
    expect(await cleanupOutputs(scope, empty, true)).toMatchObject({ success: false,
      outcomes: [{ action: 'deleted', tracked: true }], errors: [{ stage: 'release' }] });
    expect((await inventory()).outputs).toEqual([]);
  });
  it('detects a file changing during hash inspection', async () => {
    await old(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    // Intercept only output bytes, leaving manifest/token observations intact.
    vi.mocked(readFile).mockImplementation(async (...args: Parameters<typeof readFile>) => {
      const bytes = await actual.readFile(...args);
      if (typeof args[0] === 'string' && args[0].endsWith('old.md')) await actual.writeFile(args[0], 'changed after read');
      return bytes;
    });
    expect((await cleanupOutputs(scope, empty, true)).success).toBe(false);
    expect((await inventory()).outputs).toHaveLength(1); expect(unlink).not.toHaveBeenCalledWith(path.join(dir, 'old.md'));
  });
  it('rechecks changed file state when applying an earlier successful assessment', async () => {
    await old(); expect((await cleanupOutputs(scope, empty)).success).toBe(true);
    await writeFile(path.join(dir, 'old.md'), 'human edit');
    expect((await cleanupOutputs(scope, empty, true)).success).toBe(false);
    expect(await readFile(path.join(dir, 'old.md'), 'utf8')).toBe('human edit');
  });
  it('snapshots caller protection before asynchronous inspection', async () => {
    await old(); const paths = ['old.md'];
    const pending = cleanupOutputs(scope, { status: 'complete', destinations: [{ root: scope.root, paths }] }, true);
    paths.length = 0;
    expect(await pending).toMatchObject({ success: true, outcomes: [{ action: 'retained' }] });
  });
  it('rejects an invalid producer without creating state', async () => {
    expect((await cleanupOutputs({ ...scope, projectId: '' }, empty, true)).success).toBe(false);
    expect(await readdir(dir)).toEqual([]);
  });
  it('detects ownership changes during a read-only assessment', async () => {
    await old(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(readFile).mockImplementation(async (...args: Parameters<typeof readFile>) => {
      const bytes = await actual.readFile(...args);
      if (typeof args[0] === 'string' && args[0].endsWith('old.md')) await actual.writeFile(manifestPath(), JSON.stringify({ version: 1, outputs: [] }));
      return bytes;
    });
    expect(await cleanupOutputs(scope, empty)).toMatchObject({ success: false, outcomes: expect.arrayContaining([
      expect.objectContaining({ action: 'unavailable' })]) as unknown });
    expect(unlink).not.toHaveBeenCalled(); expect(rename).not.toHaveBeenCalled();
  });
  it('loses coordination before deletion and leaves the foreign lock intact', async () => {
    await old(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(readFile).mockImplementation(async (...args: Parameters<typeof readFile>) => {
      const bytes = await actual.readFile(...args);
      if (typeof args[0] === 'string' && args[0].endsWith('old.md')) await actual.writeFile(path.join(dir, '.stem/outputs.lock'), 'foreign');
      return bytes;
    });
    const result = await cleanupOutputs(scope, empty, true);
    expect(result.success).toBe(false); expect(result.errors.some(error => error.code === 'LOCK_LOST')).toBe(true);
    expect(await actual.readFile(path.join(dir, 'old.md'), 'utf8')).toBe('old\r\n');
    expect(await actual.readFile(path.join(dir, '.stem/outputs.lock'), 'utf8')).toBe('foreign');
  });
  it('retains a recreated file and old ownership after confirmed deletion', async () => {
    await old(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(unlink).mockImplementation(async file => {
      await actual.unlink(file);
      if (String(file).endsWith('old.md')) await actual.writeFile(file, 'recreated');
    });
    const result = await cleanupOutputs(scope, empty, true);
    expect(result).toMatchObject({ success: false, outcomes: [{ action: 'deleted', tracked: false }], errors: [{ stage: 'tracking' }] });
    expect(await readFile(path.join(dir, 'old.md'), 'utf8')).toBe('recreated');
    expect((await inventory()).outputs).toHaveLength(1);
  });
});
