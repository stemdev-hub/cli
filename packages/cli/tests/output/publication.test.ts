import { link, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import type * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, rename: vi.fn(actual.rename), link: vi.fn(actual.link), unlink: vi.fn(actual.unlink) };
});
import { publishOutputs } from '../../src/runtime/output/publication.js';
import type { PreparedOutputSet, PreparedTarget } from '../../src/runtime/output/publication.js';
import { hashOutputBytes } from '../../src/runtime/output/manifest.js';
import type { OutputRecord } from '../../src/runtime/output/manifest.js';
import { resolveOutputRoot } from '../../src/runtime/output/paths.js';
import { acquireOutputLock, releaseOutputLock } from '../../src/runtime/output/lock.js';

const producer = '0f671f2d-657d-4f3c-9a7d-d22f769c083a';
const other = '5a618b44-bdb6-4dcf-a5fd-8d1a1f61d293';
const empty = { status: 'complete' as const, destinations: [] };
const ready = (file = 'new.md', content = 'New 🌱\r\n'): PreparedTarget => ({ path: file, prepared: { status: 'ready', content } });
const failed: PreparedTarget = { path: 'bad.md', prepared: { status: 'failed', code: 'INCOMPLETE', message: 'Missing inclusion.' } };
const record = (file = 'old.md', overrides: Partial<OutputRecord> = {}): OutputRecord => ({ projectId: producer,
  outputSet: 'docs', path: file, sha256: hashOutputBytes(new TextEncoder().encode('old')), ...overrides });

describe('prepared output publication', () => {
  let dir: string;
  beforeEach(async () => { vi.resetAllMocks(); dir = await mkdtemp(path.join(tmpdir(), 'stem-publish-')); });
  afterEach(async () => { vi.resetAllMocks(); await rm(dir, { recursive: true, force: true }); });
  async function set(outputDir = 'out', overrides: Partial<PreparedOutputSet> = {}): Promise<PreparedOutputSet> {
    return { name: 'docs', root: await resolveOutputRoot(dir, outputDir, [path.join(dir, 'source')]),
      targets: [ready()], ifExists: 'replace', cleanup: 'keep', complete: true, ...overrides };
  }
  async function seed(outputDir = 'out', records: OutputRecord[] = [record()]) {
    const root = path.join(dir, outputDir); await mkdir(path.join(root, '.stem'), { recursive: true });
    await writeFile(path.join(root, '.stem/outputs.json'), JSON.stringify({ version: 1, outputs: records }));
    return root;
  }
  async function inventory(outputDir = 'out'): Promise<OutputRecord[]> {
    return (JSON.parse(await readFile(path.join(dir, outputDir, '.stem/outputs.json'), 'utf8')) as { outputs: OutputRecord[] }).outputs;
  }
  async function old(outputDir = 'out') { const root = await seed(outputDir); await writeFile(path.join(root, 'old.md'), 'old'); return root; }

  it('publishes exact UTF-8 content and tracks only confirmed writes', async () => {
    const result = await publishOutputs(producer, [await set()], empty);
    expect(result).toMatchObject({ success: true, targets: [{ status: 'published', tracking: 'persisted' }] });
    expect(await readFile(path.join(dir, 'out/new.md'), 'utf8')).toBe('New 🌱\r\n');
    expect(await inventory()).toEqual([record('new.md', { sha256: hashOutputBytes(new TextEncoder().encode('New 🌱\r\n')) })]);
    expect(await readdir(path.join(dir, 'out/.stem'))).toEqual(['outputs.json']);
    expect(Object.isFrozen(result.targets[0])).toBe(true);
  });
  it('keeps obsolete outputs by default and reports them', async () => {
    await old(); const result = await publishOutputs(producer, [await set()], empty);
    expect(result).toMatchObject({ success: true, cleanup: expect.arrayContaining([expect.objectContaining({ path: 'old.md', action: 'eligible' })]) as unknown });
    expect(await readFile(path.join(dir, 'out/old.md'), 'utf8')).toBe('old');
  });
  it.each(['skip', 'error', 'replace'] as const)('enforces %s for existing files', async policy => {
    await mkdir(path.join(dir, 'out')); await writeFile(path.join(dir, 'out/new.md'), 'human edit');
    const result = await publishOutputs(producer, [await set('out', { ifExists: policy })], empty);
    expect(result.success).toBe(policy !== 'error');
    expect(result.targets[0]?.status).toBe(policy === 'replace' ? 'published' : policy === 'skip' ? 'skipped' : 'not-published');
    expect(await readFile(path.join(dir, 'out/new.md'), 'utf8')).toBe(policy === 'replace' ? 'New 🌱\r\n' : 'human edit');
    if (policy === 'skip') await expect(readFile(path.join(dir, 'out/.stem/outputs.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('does not require successful composition for an intentional skip or adopt skipped files', async () => {
    await mkdir(path.join(dir, 'out')); await writeFile(path.join(dir, 'out/bad.md'), 'existing');
    expect(await publishOutputs(producer, [await set('out', { ifExists: 'skip', targets: [failed] })], empty))
      .toMatchObject({ success: true, targets: [{ status: 'skipped', tracking: 'unchanged' }] });
  });
  it('preserves old ownership on skip and updates its association after a confirmed write', async () => {
    const root = await seed('out', [record('new.md', { outputSet: 'retired' })]); await writeFile(path.join(root, 'new.md'), 'old');
    await publishOutputs(producer, [await set('out', { ifExists: 'skip' })], empty);
    expect((await inventory())[0]?.outputSet).toBe('retired');
    await publishOutputs(producer, [await set()], empty);
    expect((await inventory())[0]?.outputSet).toBe('docs');
  });
  it.each(['skip', 'error'] as const)('does not overwrite a file appearing during %s preparation', async policy => {
    const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(link).mockImplementationOnce(async (source, target) => {
      await actual.writeFile(target, 'raced'); return actual.link(source, target);
    });
    const result = await publishOutputs(producer, [await set('out', { ifExists: policy })], empty);
    expect(result.targets[0]?.status).toBe(policy === 'skip' ? 'skipped' : 'not-published');
    expect(await readFile(path.join(dir, 'out/new.md'), 'utf8')).toBe('raced');
    await expect(readFile(path.join(dir, 'out/.stem/outputs.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await readdir(path.join(dir, 'out'))).some(name => name.endsWith('.stem-tmp'))).toBe(false);
  });
  it.each([['same.md', 'same.md'], ['same.md', 'SAME.md'], ['prefix', 'prefix/file.md']])('rejects all targets on a global collision %j', async (...files) => {
    const result = await publishOutputs(producer, [await set('out', { targets: files.map(file => ready(file)) }),
      await set('independent', { name: 'other' })], empty);
    expect(result.success).toBe(false); expect(result.targets.every(item => item.status === 'not-published')).toBe(true);
    expect(await readdir(dir)).toEqual([]);
  });
  it('detects cross-root destination and bookkeeping conflicts before creating locks', async () => {
    const result = await publishOutputs(producer, [await set('out', { targets: [ready('nested/new.md')] }),
      await set('out/nested', { name: 'nested' })], empty);
    expect(result.success).toBe(false); expect(await readdir(dir)).toEqual([]);
    expect((await publishOutputs(producer, [await set('out', { targets: [ready('nested/.stem/outputs.json')] }),
      await set('out/nested', { name: 'nested' })], empty)).success).toBe(false);
    expect(await readdir(dir)).toEqual([]);
  });
  it('groups directory aliases under one lock and preserves both sets\' records', async () => {
    await mkdir(path.join(dir, 'out')); await symlink(path.join(dir, 'out'), path.join(dir, 'alias'), 'junction');
    const result = await publishOutputs(producer, [await set('out'), await set('alias', { name: 'second', targets: [ready('second.md')] })], empty);
    expect(result.success).toBe(true); expect(await inventory()).toHaveLength(2);
    expect(await readdir(path.join(dir, 'out/.stem'))).toEqual(['outputs.json']);
  });
  it('blocks protected destinations globally before any writes', async () => {
    expect((await publishOutputs(producer, [await set('.', { targets: [ready('source/a.md')] }),
      await set('independent', { name: 'other' })], empty)).success).toBe(false);
    expect(await readdir(dir)).toEqual([]);
  });
  it('rejects known other-producer ownership even for replace', async () => {
    const root = await seed('out', [record('new.md', { projectId: other })]); await writeFile(path.join(root, 'new.md'), 'old');
    expect((await publishOutputs(producer, [await set()], empty)).targets[0]?.status).toBe('not-published');
    expect(await readFile(path.join(root, 'new.md'), 'utf8')).toBe('old'); expect((await inventory())[0]?.projectId).toBe(other);
  });
  it.each(['{', '{"version":2}'])('blocks an invalid manifest root but publishes independent roots (%s)', async text => {
    await seed(); await writeFile(path.join(dir, 'out/.stem/outputs.json'), text); await old('good');
    const result = await publishOutputs(producer, [await set(), await set('good', { name: 'good', cleanup: 'prune' })], empty);
    expect(result.success).toBe(false);
    expect(result.targets.map(item => item.status)).toEqual(['not-published', 'published']);
    expect(await readFile(path.join(dir, 'out/.stem/outputs.json'), 'utf8')).toBe(text);
    expect(await readFile(path.join(dir, 'good/old.md'), 'utf8')).toBe('old');
    expect(result.cleanup.some(item => item.action === 'suppressed')).toBe(true);
  });
  it('publishes independent targets after preparation failure and suppresses every automatic prune', async () => {
    await old(); const result = await publishOutputs(producer, [await set('out', { cleanup: 'prune', targets: [failed, ready()] })], empty);
    expect(result).toMatchObject({ success: false, targets: [{ status: 'not-published' }, { status: 'published', tracking: 'persisted' }],
      cleanup: [{ action: 'suppressed' }], errors: [{ stage: 'preparation', code: 'INCOMPLETE' }] });
    expect(await readFile(path.join(dir, 'out/old.md'), 'utf8')).toBe('old');
  });
  it('preserves failed destinations and records independent writes after publication failure', async () => {
    await old(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(rename).mockImplementation(async (source, target) => {
      if (String(target).endsWith('old.md')) throw new Error('failed write'); return actual.rename(source, target);
    });
    const result = await publishOutputs(producer, [await set('out', { targets: [ready('old.md'), ready()], cleanup: 'prune' })], empty);
    expect(result).toMatchObject({ success: false, targets: [{ status: 'not-published' }, { status: 'published', tracking: 'persisted' }] });
    expect(await readFile(path.join(dir, 'out/old.md'), 'utf8')).toBe('old');
    expect(await inventory()).toHaveLength(2);
  });
  it('reports published-but-untracked content on manifest failure without a rollback claim', async () => {
    await old(); const original = await readFile(path.join(dir, 'out/.stem/outputs.json'));
    const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(rename).mockImplementation(async (source, target) => {
      if (String(target).endsWith('outputs.json')) throw new Error('tracking failed'); return actual.rename(source, target);
    });
    const result = await publishOutputs(producer, [await set('out', { cleanup: 'prune' })], empty);
    expect(result).toMatchObject({ success: false, targets: [{ status: 'published', tracking: 'failed' }],
      errors: [{ stage: 'tracking' }], cleanup: [{ action: 'suppressed' }] });
    expect(await readFile(path.join(dir, 'out/new.md'), 'utf8')).toBe('New 🌱\r\n');
    expect(await readFile(path.join(dir, 'out/.stem/outputs.json'))).toEqual(original);
  });
  it('prunes only after a complete successful run and protects selected targets', async () => {
    await old(); const result = await publishOutputs(producer, [await set('out', { cleanup: 'prune' })], empty);
    expect(result.success).toBe(true);
    expect(result.cleanup).toContainEqual(expect.objectContaining({ path: 'old.md', action: 'deleted', tracked: true }));
    expect((await inventory()).map(item => item.path)).toEqual(['new.md']);
  });
  it('does not prune an explicitly partial selection even when every target succeeded', async () => {
    await old(); expect(await publishOutputs(producer, [await set('out', { cleanup: 'prune', complete: false })], empty))
      .toMatchObject({ success: true, cleanup: [{ action: 'suppressed' }] });
    expect(await readFile(path.join(dir, 'out/old.md'), 'utf8')).toBe('old');
  });
  it('permits empty complete sets to prune and skips to complete a set without new ownership', async () => {
    await old(); expect((await publishOutputs(producer, [await set('out', { targets: [], cleanup: 'prune' })], empty)).success).toBe(true);
    expect(await inventory()).toEqual([]);
    await old(); await writeFile(path.join(dir, 'out/new.md'), 'existing');
    expect((await publishOutputs(producer, [await set('out', { ifExists: 'skip', cleanup: 'prune' })], empty)).success).toBe(true);
    expect(await inventory()).toEqual([]); expect(await readFile(path.join(dir, 'out/new.md'), 'utf8')).toBe('existing');
  });
  it('protects destinations in unselected current sets', async () => {
    await old(); const selected = await set('out', { cleanup: 'prune' });
    const result = await publishOutputs(producer, [selected], { status: 'complete', destinations: [{ root: selected.root, paths: ['old.md'] }] });
    expect(result.success).toBe(true); expect(await inventory()).toHaveLength(2);
  });
  it('publishes but refuses cleanup when protection information is unavailable', async () => {
    await old(); const result = await publishOutputs(producer, [await set('out', { cleanup: 'prune' })], { status: 'unavailable', reason: 'unresolved set' });
    expect(result).toMatchObject({ success: false, targets: [{ status: 'published' }] });
    expect(await readFile(path.join(dir, 'out/old.md'), 'utf8')).toBe('old');
  });
  it('preserves successful outcomes and leftover lock on release failure', async () => {
    const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(unlink).mockImplementation(async file => {
      if (String(file).endsWith('outputs.lock')) throw new Error('release failed'); return actual.unlink(file);
    });
    expect(await publishOutputs(producer, [await set()], empty)).toMatchObject({ success: false,
      targets: [{ status: 'published', tracking: 'persisted' }], errors: [{ stage: 'release' }] });
    expect(await readFile(path.join(dir, 'out/.stem/outputs.lock'), 'utf8')).not.toBe('');
  });
  it('continues independent roots on lock contention and never releases the foreign lock', async () => {
    const first = await set(); const lock = await acquireOutputLock(first.root);
    try {
      const token = await readFile(path.join(dir, 'out/.stem/outputs.lock'));
      expect(await publishOutputs(producer, [first, await set('other', { name: 'other' })], empty)).toMatchObject({ success: false,
        targets: [{ status: 'not-published' }, { status: 'published' }] });
      expect(await readFile(path.join(dir, 'out/.stem/outputs.lock'))).toEqual(token);
    } finally { await releaseOutputLock(lock); }
  });
  it('snapshots caller-owned content, selection and root protection arrays', async () => {
    const selected = await set(); const target = { path: 'new.md', prepared: { status: 'ready' as const, content: 'original' } };
    const selectedTargets = [target]; const pending = publishOutputs(producer, [{ ...selected, targets: selectedTargets }], empty);
    target.prepared.content = 'mutated'; selectedTargets.length = 0;
    expect((await pending).success).toBe(true); expect(await readFile(path.join(dir, 'out/new.md'), 'utf8')).toBe('original');
  });
  it('validates empty selections and invalid producer/policy before creating state', async () => {
    expect((await publishOutputs(producer, [], empty)).success).toBe(true);
    expect((await publishOutputs('', [], empty)).success).toBe(false);
    expect((await publishOutputs(producer, [await set('out', { cleanup: 'bad' as 'keep' })], empty)).success).toBe(false);
    expect(await readdir(dir)).toEqual([]);
  });

  it('preserves cross-root recorded ownership during cleanup', async () => {
    await seed('out', [record('nested/shared.md')]);
    const nested = await seed('out/nested', [record('shared.md', { projectId: other })]);
    await writeFile(path.join(nested, 'shared.md'), 'old');
    const result = await publishOutputs(producer, [await set('out', { targets: [], cleanup: 'prune' }),
      await set('out/nested', { name: 'nested', targets: [] })], empty);
    expect(result.success).toBe(true);
    expect(await readFile(path.join(nested, 'shared.md'), 'utf8')).toBe('old');
    expect(await inventory()).toHaveLength(1); expect(await inventory('out/nested')).toHaveLength(1);
  });
  it('blocks cross-root recorded ownership during publication', async () => {
    await seed('out', []);
    await seed('out/nested', [record('shared.md', { projectId: other })]);
    await writeFile(path.join(dir, 'out/nested/shared.md'), 'old');
    const result = await publishOutputs(producer, [await set('out', { targets: [ready('nested/shared.md')] }),
      await set('out/nested', { name: 'nested', targets: [] })], empty);
    expect(result.targets[0]?.status).toBe('not-published');
    expect(await readFile(path.join(dir, 'out/nested/shared.md'), 'utf8')).toBe('old');
  });
  it('retains successful publication after lock loss, suppresses pruning, and preserves the replacement lock', async () => {
    await old(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    vi.mocked(rename).mockImplementation(async (source, target) => {
      await actual.rename(source, target);
      if (String(target).endsWith('new.md')) await actual.writeFile(path.join(dir, 'out/.stem/outputs.lock'), 'foreign owner');
    });
    const result = await publishOutputs(producer, [await set('out', { cleanup: 'prune', targets: [ready(), ready('next.md')] })], empty);
    expect(result).toMatchObject({ success: false, targets: [{ status: 'published', tracking: 'failed' }, { status: 'not-published' }] });
    expect(result.errors.some(error => error.code === 'LOCK_LOST')).toBe(true);
    expect(await readFile(path.join(dir, 'out/.stem/outputs.lock'), 'utf8')).toBe('foreign owner');
    expect(await readFile(path.join(dir, 'out/old.md'), 'utf8')).toBe('old');
  });
  it('serializes concurrent coordinators with real lock acquisition', async () => {
    const selected = await set(); const actual = await vi.importActual<typeof fs>('node:fs/promises');
    let entered!: () => void; const publishing = new Promise<void>(resolve => { entered = resolve; });
    let resume!: () => void; const paused = new Promise<void>(resolve => { resume = resolve; });
    vi.mocked(rename).mockImplementationOnce(async (source, target) => { entered(); await paused; return actual.rename(source, target); });
    const first = publishOutputs(producer, [selected], empty);
    await publishing;
    let second;
    try { second = await publishOutputs(producer, [selected], empty); } finally { resume(); }
    expect((await first).success).toBe(true);
    expect(second).toMatchObject({ success: false, errors: expect.arrayContaining([expect.objectContaining({ code: 'LOCK_BUSY' })]) as unknown });
  });
  it('honors an existing writer lock across actual Node processes', async () => {
    const selected = await set(); const lock = await acquireOutputLock(selected.root);
    try {
      const moduleUrl = new URL('../../src/runtime/output/publication.ts', import.meta.url).href;
      const pathsUrl = new URL('../../src/runtime/output/paths.ts', import.meta.url).href;
      const script = `import { publishOutputs } from ${JSON.stringify(moduleUrl)};
        import { resolveOutputRoot } from ${JSON.stringify(pathsUrl)};
        const root = await resolveOutputRoot(${JSON.stringify(dir)}, 'out', []);
        const result = await publishOutputs(${JSON.stringify(producer)}, [{ name: 'docs', root,
          ifExists: 'replace', cleanup: 'keep', complete: true,
          targets: [{ path: 'child.md', prepared: { status: 'ready', content: 'child' } }] }], { status: 'complete', destinations: [] });
        process.stdout.write(JSON.stringify(result));`;
      const child = await promisify(execFile)(process.execPath, ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', script],
        { cwd: fileURLToPath(new URL('../../', import.meta.url)), windowsHide: true, timeout: 15000 });
      expect(JSON.parse(child.stdout)).toMatchObject({ success: false, errors: expect.arrayContaining([expect.objectContaining({ code: 'LOCK_BUSY' })]) as unknown });
      await expect(readFile(path.join(dir, 'out/child.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { await releaseOutputLock(lock); }
  });
});
