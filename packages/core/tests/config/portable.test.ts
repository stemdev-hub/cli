import { describe, expect, it } from 'vitest';

import { normalizeStemConfig, parseConfigJson } from '../../src/config/portable.js';
import * as core from '../../src/index.js';

describe('portable config', () => {
  it.each(['schemasDir', 'blocksdir', 'blockDir', 'cacheDri', 'extra', 'constructor', '__proto__'])('rejects unknown top-level field %s', (field) => {
    const decoded = parseConfigJson(JSON.stringify({ [field]: 'value' }), 'config.json');
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(normalizeStemConfig(decoded.data, 'config.json')).toEqual({ success: false, error: {
      code: 'CONFIG_INVALID_SCHEMA', path: 'config.json', message: `Unknown Stem config field "${field}".`
    } });
  });

  it.each(['value', '', null, false, 0, [], {}, undefined])('rejects an unknown field regardless of its value: %j', (value) => {
    const input = { version: '1', unknown: value };
    const before = structuredClone(input);
    const result = normalizeStemConfig(input, 'config.json');
    expect(result).toEqual({ success: false, error: {
      code: 'CONFIG_INVALID_SCHEMA', path: 'config.json', message: 'Unknown Stem config field "unknown".'
    } });
    expect(input).toEqual(before);
  });

  it.each(['graphURL', 'localpath', 'extra', 'constructor', '__proto__'])('rejects unknown namespace field %s even alongside a valid binding', (field) => {
    const input = { namespaces: { other: { graphUrl: 'https://example.com/graph.json', [field]: 'value' } } };
    expect(normalizeStemConfig(input, 'config.json')).toEqual({ success: false, error: {
      code: 'CONFIG_INVALID_SCHEMA', path: 'config.json', message: `Unknown Stem config field "namespaces.other.${field}".`
    } });
  });

  it('accepts every supported field and user-defined namespace aliases', () => {
    const input = {
      version: '1', namespace: 'docs', publishUrl: 'https://example.com/publish',
      blocksDir: 'blocks', viewsDir: 'views', cacheDir: '.stem/cache',
      namespaces: { shared: { graphUrl: 'https://example.com/graph.json', localPath: '../shared' } }
    };
    expect(normalizeStemConfig(input, 'config.json')).toEqual({ success: true, data: input });
  });

  it('removes schema APIs from the public entry while retaining external decoding and graph validation', () => {
    expect(core).not.toHaveProperty('decodeTagSchemaYaml');
    expect(core).not.toHaveProperty('validateSchemas');
    expect(core.decodeExternalSnapshotEnvelope).toBeTypeOf('function');
    expect(core.validateGraph).toBeTypeOf('function');
  });

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
      version: '1', blocksDir: 'content', viewsDir: 'views', cacheDir: '.stem/cache', namespaces: {}
    } });
  });
});

