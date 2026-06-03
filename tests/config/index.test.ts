import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getDefaultStemConfig,
  loadStemConfig,
  resolveStemConfig,
  STEM_CONFIG_DEFAULTS
} from '../../src/core/config/index.js';

describe('config', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-config-'));
    await mkdir(path.join(testRoot, '.stem'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('loads a valid Stem config file', async () => {
    await writeConfig(testRoot, {
      version: '1',
      blocksDir: 'docs/blocks',
      viewsDir: 'docs/views',
      schemasDir: 'docs/schemas',
      cacheDir: '.stem/custom-cache'
    });

    const result = await loadStemConfig(testRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        version: '1',
        projectRoot: testRoot,
        blocksDir: 'docs/blocks',
        viewsDir: 'docs/views',
        schemasDir: 'docs/schemas',
        cacheDir: '.stem/custom-cache'
      });
    }
  });

  it('uses defaults when the config file is missing', async () => {
    const result = await loadStemConfig(testRoot);

    expect(result).toEqual({ success: true, data: getDefaultStemConfig(testRoot) });
  });

  it('applies defaults for omitted optional fields', () => {
    const result = resolveStemConfig({ version: '1', blocksDir: 'content/blocks' }, testRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        version: '1',
        projectRoot: testRoot,
        blocksDir: 'content/blocks',
        viewsDir: STEM_CONFIG_DEFAULTS.viewsDir,
        schemasDir: STEM_CONFIG_DEFAULTS.schemasDir,
        cacheDir: STEM_CONFIG_DEFAULTS.cacheDir
      });
    }
  });

  it('defaults missing version to version 1', () => {
    const result = resolveStemConfig({}, testRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1');
    }
  });

  it('returns CONFIG_INVALID_JSON for malformed JSON', async () => {
    await writeFile(path.join(testRoot, '.stem', 'config.json'), '{ broken json', 'utf8');

    const result = await loadStemConfig(testRoot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFIG_INVALID_JSON');
      expect(result.error.path).toBe(path.join(testRoot, '.stem', 'config.json'));
    }
  });

  it('returns CONFIG_INVALID_SCHEMA for a non-object JSON value', async () => {
    await writeFile(path.join(testRoot, '.stem', 'config.json'), '[]', 'utf8');

    const result = await loadStemConfig(testRoot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFIG_INVALID_SCHEMA');
    }
  });

  it('returns CONFIG_INVALID_SCHEMA for non-string config fields', async () => {
    await writeFile(path.join(testRoot, '.stem', 'config.json'), '{"version":"1","blocksDir":123}', 'utf8');

    const result = await loadStemConfig(testRoot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFIG_INVALID_SCHEMA');
    }
  });

  it('returns CONFIG_UNSUPPORTED_VERSION for unknown config versions', () => {
    const result = resolveStemConfig({ version: '2' }, testRoot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFIG_UNSUPPORTED_VERSION');
    }
  });

  it('rejects absolute config paths', () => {
    const result = resolveStemConfig({ blocksDir: path.join(testRoot, 'blocks') }, testRoot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFIG_INVALID_PATH');
    }
  });

  it('rejects config paths containing parent directory segments', () => {
    const result = resolveStemConfig({ viewsDir: '../views' }, testRoot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFIG_INVALID_PATH');
    }
  });

  it('normalizes Windows separators to POSIX separators', () => {
    const result = resolveStemConfig({ blocksDir: 'docs\\blocks' }, testRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocksDir).toBe('docs/blocks');
    }
  });

  it('strips leading dot-slash segments', () => {
    const result = resolveStemConfig({ viewsDir: './docs/views' }, testRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.viewsDir).toBe('docs/views');
    }
  });

  it('strips trailing slashes', () => {
    const result = resolveStemConfig({ schemasDir: 'blocks/schemas///' }, testRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemasDir).toBe('blocks/schemas');
    }
  });

  it('resolves all custom directory fields', () => {
    const result = resolveStemConfig(
      {
        blocksDir: 'content/blocks',
        viewsDir: 'content/views',
        schemasDir: 'content/schemas',
        cacheDir: '.stem/state'
      },
      testRoot
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocksDir).toBe('content/blocks');
      expect(result.data.viewsDir).toBe('content/views');
      expect(result.data.schemasDir).toBe('content/schemas');
      expect(result.data.cacheDir).toBe('.stem/state');
    }
  });

  it('resolveStemConfig is pure for the same input', () => {
    const rawConfig = { blocksDir: 'content/blocks' };

    const firstResult = resolveStemConfig(rawConfig, testRoot);
    const secondResult = resolveStemConfig(rawConfig, testRoot);

    expect(secondResult).toEqual(firstResult);
  });

  it('getDefaultStemConfig returns defaults for a project root', () => {
    expect(getDefaultStemConfig(testRoot)).toEqual({
      version: STEM_CONFIG_DEFAULTS.version,
      projectRoot: testRoot,
      blocksDir: STEM_CONFIG_DEFAULTS.blocksDir,
      viewsDir: STEM_CONFIG_DEFAULTS.viewsDir,
      schemasDir: STEM_CONFIG_DEFAULTS.schemasDir,
      cacheDir: STEM_CONFIG_DEFAULTS.cacheDir
    });
  });
});

async function writeConfig(projectRoot: string, config: Record<string, unknown>): Promise<void> {
  await writeFile(path.join(projectRoot, '.stem', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
}
