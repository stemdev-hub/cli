import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, open, readdir, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import type * as fsPromises from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof fsPromises>();
  return { ...actual, open: vi.fn(actual.open), unlink: vi.fn(actual.unlink) };
});

import { acquireOutputLock, assertOutputUnlocked, releaseOutputLock, verifyOutputLock } from '../../src/runtime/output/lock.js';
import { resolveOutputRoot } from '../../src/runtime/output/paths.js';

describe('output writer locks', () => {
  let dir: string;
  const children: ChildProcess[] = [];
  beforeEach(async () => { vi.resetAllMocks(); dir = await mkdtemp(path.join(tmpdir(), 'stem-output-lock-')); });
  afterEach(async () => {
    for (const child of children.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; }
    }
    await rm(dir, { recursive: true, force: true });
  });

  function worker(root: string) {
    const source = `
      import { resolveOutputRoot } from ${JSON.stringify(new URL('../../src/runtime/output/paths.ts', import.meta.url).href)};
      import { acquireOutputLock, releaseOutputLock } from ${JSON.stringify(new URL('../../src/runtime/output/lock.ts', import.meta.url).href)};
      try {
        const lock = await acquireOutputLock(await resolveOutputRoot(process.env.STEM_TEST_ROOT, '.', []));
        process.on('message', async () => {
          try { await releaseOutputLock(lock); process.send('released'); }
          catch (e) { process.send(e.code ?? e.message); }
          process.disconnect();
        });
        process.send('acquired');
      } catch(e) { process.send(e.code ?? e.message); process.disconnect(); }
    `;
    const child = spawn(process.execPath, ['--import', pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href,
      '--input-type=module', '--eval', source], { env: { ...process.env, STEM_TEST_ROOT: root }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    children.push(child);
    return child;
  }

  async function message(child: ChildProcess): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const onExit = (code: number | null) => { clear(); reject(new Error(`Worker exited before reporting (${String(code)}).`)); };
      const onMessage = (value: unknown) => { clear(); resolve(value); };
      const onError = (error: Error) => { clear(); reject(error); };
      const clear = () => { child.off('exit', onExit); child.off('message', onMessage); child.off('error', onError); };
      child.once('exit', onExit); child.once('message', onMessage); child.once('error', onError);
    });
  }

  it('creates a unique lock, excludes another owner and permits reacquisition after release', async () => {
    const root = await resolveOutputRoot(dir, '.', []);
    const lock = await acquireOutputLock(root);
    const bytes = await readFile(path.join(dir, '.stem/outputs.lock'));
    await expect(acquireOutputLock(root)).rejects.toMatchObject({ code: 'LOCK_BUSY' });
    expect(await readFile(path.join(dir, '.stem/outputs.lock'))).toEqual(bytes);
    await verifyOutputLock(lock);
    await releaseOutputLock(lock);
    await expect(verifyOutputLock(lock)).rejects.toMatchObject({ code: 'LOCK_LOST' });
    const next = await acquireOutputLock(root);
    expect(await readFile(path.join(dir, '.stem/outputs.lock'))).not.toEqual(bytes);
    await releaseOutputLock(next);
  });

  it('never creates state when checking an absent lock', async () => {
    await assertOutputUnlocked(await resolveOutputRoot(dir, 'missing/output', []));
    expect(await readdir(dir)).toEqual([]);
  });

  it('preserves a replacement lock when ownership is lost', async () => {
    const lock = await acquireOutputLock(await resolveOutputRoot(dir, '.', []));
    await unlink(path.join(dir, '.stem/outputs.lock'));
    await writeFile(path.join(dir, '.stem/outputs.lock'), 'another invocation');
    await expect(verifyOutputLock(lock)).rejects.toMatchObject({ code: 'LOCK_LOST' });
    await expect(releaseOutputLock(lock)).rejects.toMatchObject({ code: 'LOCK_RELEASE_FAILED' });
    expect(await readFile(path.join(dir, '.stem/outputs.lock'), 'utf8')).toBe('another invocation');
  });

  it('does not steal an unrecognized leftover lock or accept a forged owner', async () => {
    const root = await resolveOutputRoot(dir, '.', []);
    await mkdir(path.join(dir, '.stem'));
    await writeFile(path.join(dir, '.stem/outputs.lock'), 'old pid: 1');
    await expect(acquireOutputLock(root)).rejects.toMatchObject({ code: 'LOCK_BUSY' });
    await expect(assertOutputUnlocked(root)).rejects.toMatchObject({ code: 'LOCK_BUSY' });
    await expect(releaseOutputLock({ root })).rejects.toMatchObject({ code: 'LOCK_LOST' });
    expect(await readFile(path.join(dir, '.stem/outputs.lock'), 'utf8')).toBe('old pid: 1');
  });

  it('shares a lock across root aliases and rejects escaped bookkeeping', async () => {
    await mkdir(path.join(dir, 'out'));
    await symlink(path.join(dir, 'out'), path.join(dir, 'alias'), 'junction');
    const lock = await acquireOutputLock(await resolveOutputRoot(dir, 'out', []));
    try {
      await expect(acquireOutputLock(await resolveOutputRoot(dir, 'alias', []))).rejects.toMatchObject({ code: 'LOCK_BUSY' });
    } finally { await releaseOutputLock(lock); }
    await mkdir(path.join(dir, 'unsafe'));
    await symlink(path.join(dir, 'out'), path.join(dir, 'unsafe/.stem'), 'junction');
    await expect(acquireOutputLock(await resolveOutputRoot(dir, 'unsafe', []))).rejects.toMatchObject({ code: 'INVALID_PATH' });
    expect(await readdir(path.join(dir, 'out'))).toEqual(['.stem']);
  });

  it('cleans up its own partially initialized lock after a write failure', async () => {
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    vi.mocked(open).mockImplementationOnce(async (...args) => {
      const handle = await actual.open(...args);
      vi.spyOn(handle, 'writeFile').mockRejectedValueOnce(new Error('disk full'));
      return handle;
    });
    await expect(acquireOutputLock(await resolveOutputRoot(dir, '.', []))).rejects.toMatchObject({ code: 'IO_ERROR' });
    expect(await readdir(path.join(dir, '.stem'))).toEqual([]);
  });

  it('preserves a foreign replacement when lock initialization fails', async () => {
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    vi.mocked(open).mockImplementationOnce(async (...args) => {
      const handle = await actual.open(...args);
      vi.spyOn(handle, 'writeFile').mockImplementationOnce(async () => {
        await actual.unlink(path.join(dir, '.stem/outputs.lock'));
        await actual.writeFile(path.join(dir, '.stem/outputs.lock'), 'foreign');
        throw new Error('initialization failed');
      });
      return handle;
    });
    await expect(acquireOutputLock(await resolveOutputRoot(dir, '.', []))).rejects.toMatchObject({ code: 'IO_ERROR' });
    expect(await readFile(path.join(dir, '.stem/outputs.lock'), 'utf8')).toBe('foreign');
  });

  it('reports acquisition and release failures without pretending to have released', async () => {
    const root = await resolveOutputRoot(dir, '.', []);
    vi.mocked(open).mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    await expect(acquireOutputLock(root)).rejects.toMatchObject({ code: 'IO_ERROR' });
    expect(await readdir(path.join(dir, '.stem'))).toEqual([]);
    const lock = await acquireOutputLock(root);
    vi.mocked(unlink).mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    await expect(releaseOutputLock(lock)).rejects.toMatchObject({ code: 'LOCK_RELEASE_FAILED' });
    await expect(acquireOutputLock(root)).rejects.toMatchObject({ code: 'LOCK_BUSY' });
  });

  it('coordinates two real processes and leaves an independent root usable', async () => {
    const first = worker(dir);
    expect(await message(first)).toBe('acquired');
    const second = worker(dir);
    expect(await message(second)).toBe('LOCK_BUSY');
    const independent = worker(path.join(dir, 'other'));
    expect(await message(independent)).toBe('acquired');
    const releasedOther = message(independent); independent.send('release'); expect(await releasedOther).toBe('released');
    const released = message(first); first.send('release'); expect(await released).toBe('released');
    expect(await readdir(path.join(dir, '.stem'))).toEqual([]);
  }, 15_000);

  it('preserves a crashed process lock until explicit manual recovery', async () => {
    const child = worker(dir);
    expect(await message(child)).toBe('acquired');
    const ended = once(child, 'exit'); child.kill(); await ended;
    const root = await resolveOutputRoot(dir, '.', []);
    await expect(acquireOutputLock(root)).rejects.toMatchObject({ code: 'LOCK_BUSY' });
    // The test has confirmed the writer stopped before simulating manual recovery.
    await unlink(path.join(dir, '.stem/outputs.lock'));
    await releaseOutputLock(await acquireOutputLock(root));
  }, 15_000);
});
