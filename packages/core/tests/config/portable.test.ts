import { describe, expect, it } from 'vitest';

import { normalizeStemConfig, parseConfigJson } from '../../src/config/portable.js';

describe('portable config', () => {
  it.each(['/root', '\\root', 'C:/root', 'z:\\root', '//server/share', '\\\\server\\share'])('rejects absolute path %s', (value) => {
    const result = normalizeStemConfig({ blocksDir: value }, 'config.json');
    expect(result).toEqual({ success: false, error: { code: 'CONFIG_INVALID_PATH', path: 'config.json',
      message: `Stem config field "blocksDir" has invalid path "${value}": must be project-relative.` } });
    const namespace = normalizeStemConfig({ namespaces: { other: { localPath: value } } }, 'config.json');
    expect(namespace.success).toBe(false);
    if (!namespace.success) expect(namespace.error.code).toBe('CONFIG_INVALID_PATH');
  });

  it.each([
    ['././docs\\blocks///', 'docs/blocks'], ['docs//./blocks', 'docs//./blocks'],
    ['C:relative', 'C:relative'], ['.../blocks', '.../blocks']
  ])('preserves normalization of %s', (value, expected) => {
    const result = normalizeStemConfig({ blocksDir: value }, 'config.json');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.blocksDir).toBe(expected);
  });

  it.each(['', '.', '././', 'a/../blocks', 'a\\..\\blocks'])('rejects invalid directory %s', (value) => {
    const result = normalizeStemConfig({ viewsDir: value }, 'config.json');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CONFIG_INVALID_PATH');
  });

  it('allows parent segments for namespace paths only', () => {
    const result = normalizeStemConfig({ namespaces: { other: { localPath: './..\\other/' } } }, 'config.json');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.namespaces).toEqual({ other: { localPath: '../other' } });
  });

  it('decodes JSON and supplies defaults without a project root', () => {
    const decoded = parseConfigJson('{"blocksDir":"./content/"}', 'config.json');
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(normalizeStemConfig(decoded.data, 'config.json')).toEqual({ success: true, data: {
      version: '1', blocksDir: 'content', viewsDir: 'views', schemasDir: 'blocks/schemas', cacheDir: '.stem/cache', namespaces: {}
    } });
  });
});

