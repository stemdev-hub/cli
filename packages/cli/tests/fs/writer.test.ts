import { randomUUID } from 'node:crypto';
import type * as crypto from 'node:crypto';
import { link, mkdtemp, mkdir, open, readdir, readFile, rm, writeFile as writeTextFile, rename, unlink } from 'node:fs/promises';
import type * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof crypto>();
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual,
    link: vi.fn(actual.link),
    open: vi.fn(actual.open),
    rename: vi.fn(actual.rename),
    unlink: vi.fn(actual.unlink)
  };
});

import { ensureDir, writeFile } from '../../src/runtime/fs/writer.js';

describe('writer', () => {
  let testRoot: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-writer-'));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('writes file content correctly', async () => {
    const filePath = path.join(testRoot, 'blocks', 'auth.md');

    const result = await writeFile(filePath, 'content');

    expect(result).toEqual({ success: true });
    await expect(readFile(filePath, 'utf8')).resolves.toBe('content');
  });

  it('cleans up the temporary file after a successful atomic write', async () => {
    const filePath = path.join(testRoot, 'blocks', 'auth.md');

    const result = await writeFile(filePath, 'content');

    expect(result).toEqual({ success: true });
    await expect(readdir(path.dirname(filePath))).resolves.toEqual(['auth.md']);
  });

  it('does not overwrite an existing file by default', async () => {
    const filePath = path.join(testRoot, 'blocks', 'auth.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeTextFile(filePath, 'original', 'utf8');

    const result = await writeFile(filePath, 'updated');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('ALREADY_EXISTS');
      expect(result.error.path).toBe(filePath);
    }
    await expect(readFile(filePath, 'utf8')).resolves.toBe('original');
  });

  it('overwrites an existing file when overwrite is true', async () => {
    const filePath = path.join(testRoot, 'blocks', 'auth.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeTextFile(filePath, 'original', 'utf8');

    const result = await writeFile(filePath, 'updated', { overwrite: true });

    expect(result).toEqual({ success: true });
    await expect(readFile(filePath, 'utf8')).resolves.toBe('updated');
  });

  it('creates parent directories automatically', async () => {
    const filePath = path.join(testRoot, 'blocks', 'nested', 'auth.md');

    const result = await writeFile(filePath, 'content');

    expect(result).toEqual({ success: true });
    await expect(readFile(filePath, 'utf8')).resolves.toBe('content');
  });

  it('cleans up the temporary file after a write failure', async () => {
    const dirPath = path.join(testRoot, 'blocks', 'auth.md');
    await mkdir(dirPath, { recursive: true });

    const result = await writeFile(dirPath, 'content', { overwrite: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.path).toBe(dirPath);
    }
    await expect(readdir(path.dirname(dirPath))).resolves.toEqual(['auth.md']);
  });

  it('creates a directory and all parents', async () => {
    const dirPath = path.join(testRoot, 'blocks', 'nested');

    const result = await ensureDir(dirPath);

    expect(result).toEqual({ success: true });
    await expect(writeTextFile(path.join(dirPath, 'auth.md'), 'content', 'utf8')).resolves.toBeUndefined();
  });

  it('preserves a destination created immediately before publication', async () => {
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    const target = path.join(testRoot, 'race.md');
    vi.mocked(link).mockImplementationOnce(async (temporary, destination) => {
      await expect(readFile(temporary, 'utf8')).resolves.toBe('candidate');
      await writeTextFile(destination, 'concurrent creator');
      await actual.link(temporary, destination);
    });

    expect(await writeFile(target, 'candidate')).toMatchObject({
      success: false, error: { code: 'ALREADY_EXISTS', path: target }
    });
    await expect(readFile(target, 'utf8')).resolves.toBe('concurrent creator');
    await expect(readdir(testRoot)).resolves.toEqual(['race.md']);
    expect(rename).not.toHaveBeenCalled();
  });

  it('gives concurrent creators separate temporary files and publishes exactly one', async () => {
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    const target = path.join(testRoot, 'shared.md');
    const staged: string[] = [];
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(link).mockImplementation(async (temporary, destination) => {
      staged.push(String(temporary));
      if (staged.length === 2) release();
      await ready;
      await actual.link(temporary, destination);
    });

    const contents = ['first complete content', 'second complete content'];
    const results = await Promise.all(contents.map((content) => writeFile(target, content)));
    expect(new Set(staged).size).toBe(2);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.find((result) => !result.success)).toMatchObject({ error: { code: 'ALREADY_EXISTS' } });
    await expect(readFile(target, 'utf8')).resolves.toBe(contents[results.findIndex((result) => result.success)]);
    await expect(readdir(testRoot)).resolves.toEqual(['shared.md']);
  });

  it('preserves a colliding temporary file when exclusive creation fails', async () => {
    const target = path.join(testRoot, 'collision.md');
    const id = '00000000-0000-4000-8000-000000000001';
    const temporary = `${target}.${id}.stem-tmp`;
    vi.mocked(randomUUID).mockReturnValueOnce(id);
    await writeTextFile(temporary, 'owned by another invocation');

    expect(await writeFile(target, 'candidate')).toMatchObject({ success: false, error: { code: 'ALREADY_EXISTS' } });
    await expect(readFile(temporary, 'utf8')).resolves.toBe('owned by another invocation');
    await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(unlink).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it('publishes concurrent replacements from independent complete temporary files', async () => {
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    const target = path.join(testRoot, 'replace.md');
    await writeTextFile(target, 'original');
    const staged: string[] = [];
    let publication = Promise.resolve();
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(rename).mockImplementation(async (temporary, destination) => {
      staged.push(String(temporary));
      if (staged.length === 2) release();
      await ready;
      // Both files are prepared before either publishes. Order the OS renames
      // deterministically; Windows can reject simultaneous replacement renames.
      publication = publication.then(() => actual.rename(temporary, destination));
      await publication;
    });

    const contents = ['first replacement', 'second replacement'];
    expect(await Promise.all(contents.map((content) => writeFile(target, content, { overwrite: true }))))
      .toEqual([{ success: true }, { success: true }]);
    expect(new Set(staged).size).toBe(2);
    expect(contents).toContain(await readFile(target, 'utf8'));
    await expect(readdir(testRoot)).resolves.toEqual(['replace.md']);
    expect(unlink).not.toHaveBeenCalled();
  });

  it('does not publish if closing the prepared file reports an error', async () => {
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    const target = path.join(testRoot, 'close.md');
    await writeTextFile(target, 'original');
    vi.mocked(open).mockImplementationOnce(async (temporary, flags) => {
      const file = await actual.open(temporary, flags);
      const close = file.close.bind(file);
      vi.spyOn(file, 'close').mockImplementationOnce(async () => {
        await close();
        throw new Error('Close failed');
      });
      return file;
    });

    expect(await writeFile(target, 'candidate', { overwrite: true })).toMatchObject({
      success: false, error: { code: 'WRITE_FAILED' }
    });
    expect(rename).not.toHaveBeenCalled();
    await expect(readFile(target, 'utf8')).resolves.toBe('original');
    await expect(readdir(testRoot)).resolves.toEqual(['close.md']);
  });

  it('does not touch a pre-existing fixed-name temporary file', async () => {
    const target = path.join(testRoot, 'source.md');
    await writeTextFile(`${target}.stem-tmp`, 'unrelated content');

    expect(await writeFile(target, 'candidate')).toEqual({ success: true });
    await expect(readFile(`${target}.stem-tmp`, 'utf8')).resolves.toBe('unrelated content');
    await expect(readdir(testRoot)).resolves.toEqual(['source.md', 'source.md.stem-tmp']);
  });

  it('closes and removes a partially written temporary file without replacing the destination', async () => {
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    const target = path.join(testRoot, 'partial.md');
    await writeTextFile(target, 'original');
    vi.mocked(open).mockImplementationOnce(async (temporary, flags) => {
      const file = await actual.open(temporary, flags);
      const write = file.writeFile.bind(file);
      vi.spyOn(file, 'writeFile').mockImplementationOnce(async () => {
        await write('partial');
        throw new Error('Disk full');
      });
      return file;
    });

    expect(await writeFile(target, 'candidate', { overwrite: true })).toMatchObject({
      success: false, error: { code: 'WRITE_FAILED' }
    });
    await expect(readFile(target, 'utf8')).resolves.toBe('original');
    await expect(readdir(testRoot)).resolves.toEqual(['partial.md']);
    expect(rename).not.toHaveBeenCalled();
  });

  it('preserves existing content when replacement fails and cleans only its temporary file', async () => {
    const target = path.join(testRoot, 'preserved.md');
    await writeTextFile(target, 'original');
    vi.mocked(rename).mockRejectedValueOnce(Object.assign(new Error('Denied'), { code: 'EPERM' }));

    expect(await writeFile(target, 'candidate', { overwrite: true })).toMatchObject({
      success: false, error: { code: 'PERMISSION_DENIED', path: target }
    });
    await expect(readFile(target, 'utf8')).resolves.toBe('original');
    await expect(readdir(testRoot)).resolves.toEqual(['preserved.md']);
    expect(unlink).not.toHaveBeenCalledWith(target);
  });

  it('reports unsupported hard-link publication without an overwrite fallback', async () => {
    const target = path.join(testRoot, 'unsupported.md');
    vi.mocked(link).mockRejectedValueOnce(Object.assign(new Error('Unsupported'), { code: 'EOPNOTSUPP' }));

    expect(await writeFile(target, 'candidate')).toMatchObject({ success: false, error: { code: 'WRITE_FAILED' } });
    expect(rename).not.toHaveBeenCalled();
    await expect(readdir(testRoot)).resolves.toEqual([]);
  });

  it('reports successful publication even if temporary cleanup fails afterwards', async () => {
    const target = path.join(testRoot, 'published.md');
    vi.mocked(unlink).mockRejectedValueOnce(Object.assign(new Error('Denied'), { code: 'EPERM' }));

    expect(await writeFile(target, 'candidate')).toEqual({ success: true });
    await expect(readFile(target, 'utf8')).resolves.toBe('candidate');
    const remaining = await readdir(testRoot);
    expect(remaining.filter((name) => name.endsWith('.stem-tmp'))).toHaveLength(1);
    expect(unlink).not.toHaveBeenCalledWith(target);
  });

  it('returns ALREADY_EXISTS error when EEXIST is thrown during write', async () => {
    const filePath = path.join(testRoot, 'blocks', 'already-exists.md');

    // Simulate a race condition where rename() sees EEXIST
    const renameError = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    vi.mocked(rename).mockRejectedValueOnce(renameError);

    const result = await writeFile(filePath, 'content', { overwrite: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('ALREADY_EXISTS');
      expect(result.error.path).toBe(path.resolve(filePath));
    }
  });

  it('returns WRITE_FAILED with fallback message when an unrecognized error is thrown', async () => {
    const filePath = path.join(testRoot, 'blocks', 'fail.md');

    // Simulate an error with no recognized code
    const unknownError = new Error('Disk quota exceeded');
    vi.mocked(rename).mockRejectedValueOnce(unknownError);

    const result = await writeFile(filePath, 'content', { overwrite: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('WRITE_FAILED');
    }
  });

  it('preserves the publication error when temporary cleanup also fails', async () => {
    const target = path.join(testRoot, 'preserve-error.md');
    await writeTextFile(target, 'original');
    vi.mocked(rename).mockRejectedValueOnce(Object.assign(new Error('I/O failure'), { code: 'EIO' }));
    const unlinkError = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    vi.mocked(unlink).mockRejectedValueOnce(unlinkError);

    expect(await writeFile(target, 'content', { overwrite: true })).toMatchObject({
      success: false, error: { code: 'WRITE_FAILED', path: target }
    });
    await expect(readFile(target, 'utf8')).resolves.toBe('original');
  });
});
