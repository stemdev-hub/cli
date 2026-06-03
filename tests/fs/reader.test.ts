import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readFile, readFileStats, toRelativePath } from '../../src/core/fs/reader.js';

describe('reader', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-reader-'));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('reads file content as UTF-8 text', async () => {
    const filePath = path.join(testRoot, 'blocks', 'unicode.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, 'Hello Stem\nUnicode: café', 'utf8');

    const result = await readFile(filePath);

    expect(result).toEqual({ success: true, data: 'Hello Stem\nUnicode: café' });
  });

  it('returns NOT_FOUND for a missing file', async () => {
    const filePath = path.join(testRoot, 'missing.md');

    const result = await readFile(filePath);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.path).toBe(filePath);
    }
  });

  it('returns READ_FAILED for a path that cannot be read as a text file', async () => {
    const dirPath = path.join(testRoot, 'blocks');
    await mkdir(dirPath, { recursive: true });

    const result = await readFile(dirPath);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('READ_FAILED');
      expect(result.error.path).toBe(dirPath);
    }
  });

  it('returns file stats with the correct size', async () => {
    const filePath = path.join(testRoot, 'blocks', 'auth.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, '12345', 'utf8');

    const result = await readFileStats(filePath);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.size).toBe(5);
    }
  });

  it('returns mtimeMs as an integer', async () => {
    const filePath = path.join(testRoot, 'blocks', 'auth.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, 'content', 'utf8');

    const result = await readFileStats(filePath);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Number.isInteger(result.data.mtimeMs)).toBe(true);
    }
  });

  it('returns dev as a string', async () => {
    const filePath = path.join(testRoot, 'blocks', 'auth.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, 'content', 'utf8');

    const result = await readFileStats(filePath);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.dev).toBe('string');
      expect(result.data.dev.length).toBeGreaterThan(0);
    }
  });

  it('returns inode as a string', async () => {
    const filePath = path.join(testRoot, 'blocks', 'auth.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, 'content', 'utf8');

    const result = await readFileStats(filePath);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.inode).toBe('string');
      expect(result.data.inode.length).toBeGreaterThan(0);
    }
  });

  it('converts relative paths to POSIX separators on all platforms', () => {
    const projectRoot = path.join(testRoot, 'project');
    const filePath = path.join(projectRoot, 'blocks', 'nested', 'auth.md');

    expect(toRelativePath(filePath, projectRoot)).toBe('blocks/nested/auth.md');
  });

  it('produces a path relative to the project root', () => {
    const projectRoot = path.join(testRoot, 'project');
    const filePath = path.join(projectRoot, 'views', 'api.md');

    expect(toRelativePath(filePath, projectRoot)).toBe('views/api.md');
  });
});
