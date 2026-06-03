import { mkdtemp, mkdir, readFile, rm, writeFile as writeTextFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureDir, writeFile } from '../../src/core/fs/writer.js';

describe('writer', () => {
  let testRoot: string;

  beforeEach(async () => {
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
    await expect(readFile(`${filePath}.stem-tmp`, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
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
    await expect(readFile(`${dirPath}.stem-tmp`, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('creates a directory and all parents', async () => {
    const dirPath = path.join(testRoot, 'blocks', 'nested');

    const result = await ensureDir(dirPath);

    expect(result).toEqual({ success: true });
    await expect(writeTextFile(path.join(dirPath, 'auth.md'), 'content', 'utf8')).resolves.toBeUndefined();
  });
});
