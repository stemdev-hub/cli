import { describe, expect, it } from 'vitest';

import { normalizeStemConfig, parseConfigJson } from '../../src/config/portable.js';
import * as core from '../../src/index.js';

const projectId = '0f671f2d-657d-4f3c-9a7d-d22f769c083a';

describe('portable config', () => {
  it.each([
    undefined, null, false, 0, [], {}, '', ' ', projectId.toUpperCase(),
    ` ${projectId}`, `${projectId} `, `${projectId}\n`, `${projectId}\r\n`, `{${projectId}}`,
    `urn:uuid:${projectId}`, projectId.replaceAll('-', ''), projectId.slice(1), `${projectId}0`,
    projectId.replace('0f67', 'gf67'), projectId.replace('-4f3c-', '-7f3c-'),
    projectId.replace('-9a7d-', '-ca7d-'), '00000000-0000-0000-0000-000000000000',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
  ])('rejects invalid identity without changing the input: %j', (value) => {
    const decoded = parseConfigJson(JSON.stringify({ projectId: value }), 'config.json');
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    const before = structuredClone(decoded.data);
    expect(normalizeStemConfig(decoded.data, 'config.json')).toMatchObject({ success: false, error: {
      code: 'CONFIG_INVALID_SCHEMA', path: 'config.json',
      message: 'Stem config field "projectId" is required and must be a lowercase hyphenated UUIDv4.'
    } });
    expect(decoded.data).toEqual(before);
  });

  it.each(['8', '9', 'a', 'b'])('accepts variant nibble %s without changing identity or input', (variant) => {
    const input = Object.freeze({ projectId: projectId.replace('-9a7d-', `-${variant}a7d-`) });
    const first = normalizeStemConfig(input, 'config.json');
    expect(first).toMatchObject({ success: true, data: { projectId: input.projectId } });
    expect(normalizeStemConfig(input, 'config.json')).toEqual(first);
    expect(core).not.toHaveProperty('getDefaultPortableConfig');
    expect(core.STEM_CONFIG_DEFAULTS).not.toHaveProperty('projectId');
    expect(core.STEM_CONFIG_DEFAULTS).not.toHaveProperty('version');
    if (first.success) expect(first.data).not.toHaveProperty('version');
  });
  it.each(['version', 'projectID', 'schemasDir', 'blocksdir', 'blockDir', 'cacheDri', 'extra', 'constructor', '__proto__'])('rejects unknown top-level field %s', (field) => {
    const decoded = parseConfigJson(JSON.stringify({ [field]: 'value' }), 'config.json');
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(normalizeStemConfig(decoded.data, 'config.json')).toEqual({ success: false, error: {
      code: 'CONFIG_INVALID_SCHEMA', path: 'config.json', message: `Unknown Stem config field "${field}".`
    } });
  });

  it.each(['value', '', null, false, 0, [], {}, undefined])('rejects an unknown field regardless of its value: %j', (value) => {
    const input = { projectId, unknown: value };
    const before = structuredClone(input);
    const result = normalizeStemConfig(input, 'config.json');
    expect(result).toEqual({ success: false, error: {
      code: 'CONFIG_INVALID_SCHEMA', path: 'config.json', message: 'Unknown Stem config field "unknown".'
    } });
    expect(input).toEqual(before);
  });

  it.each(['graphURL', 'localpath', 'extra', 'constructor', '__proto__'])('rejects unknown namespace field %s even alongside a valid binding', (field) => {
    const input = { projectId, namespaces: { other: { graphUrl: 'https://example.com/graph.json', [field]: 'value' } } };
    expect(normalizeStemConfig(input, 'config.json')).toEqual({ success: false, error: {
      code: 'CONFIG_INVALID_SCHEMA', path: 'config.json', message: `Unknown Stem config field "namespaces.other.${field}".`
    } });
  });

  it('accepts every supported field and user-defined namespace aliases', () => {
    const input = {
      projectId, namespace: 'docs', publishUrl: 'https://example.com/publish',
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
    const result = normalizeStemConfig({ projectId, blocksDir: value }, 'config.json');
    expect(result).toEqual({ success: false, error: { code: 'CONFIG_INVALID_PATH', path: 'config.json',
      message: `Stem config field "blocksDir" has invalid path "${value}": must be project-relative.` } });
    const namespace = normalizeStemConfig({ projectId, namespaces: { other: { localPath: value } } }, 'config.json');
    expect(namespace.success).toBe(false);
    if (!namespace.success) expect(namespace.error.code).toBe('CONFIG_INVALID_PATH');
  });

  it.each([
    ['././docs\\blocks///', 'docs/blocks'], ['docs//./blocks', 'docs//./blocks'],
    ['C:relative', 'C:relative'], ['.../blocks', '.../blocks']
  ])('preserves normalization of %s', (value, expected) => {
    const result = normalizeStemConfig({ projectId, blocksDir: value }, 'config.json');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.blocksDir).toBe(expected);
  });

  it.each(['', '.', '././', 'a/../blocks', 'a\\..\\blocks'])('rejects invalid directory %s', (value) => {
    const result = normalizeStemConfig({ projectId, viewsDir: value }, 'config.json');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CONFIG_INVALID_PATH');
  });

  it('allows parent segments for namespace paths only', () => {
    const result = normalizeStemConfig({ projectId, namespaces: { other: { localPath: './..\\other/' } } }, 'config.json');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.namespaces).toEqual({ other: { localPath: '../other' } });
  });

  it('decodes JSON and supplies defaults without a project root', () => {
    const decoded = parseConfigJson(JSON.stringify({ projectId, blocksDir: "./content/" }), 'config.json');
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(normalizeStemConfig(decoded.data, 'config.json')).toEqual({ success: true, data: {
      projectId, blocksDir: 'content', viewsDir: 'views', cacheDir: '.stem/cache', namespaces: {}
    } });
  });
});

