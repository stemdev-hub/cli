import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDefaultStemConfig } from '../../src/runtime/config/index.js';
import { loadSchemas } from '../../src/runtime/operations/schemas.js';

describe('loadSchemas characterization', () => {
  let root: string;
  let filePath: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'stem-schema-decoding-'));
    await mkdir(path.join(root, 'blocks/schemas'), { recursive: true });
    filePath = path.join(root, 'blocks/schemas/a.yaml');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each([
    ['empty', '', 'expected a document, but the input is empty'],
    ['comment-only', '# comment\n', 'expected a document, but the input is empty'],
    ['malformed', 'name: [\n', 'deficient indentation']
  ])('preserves YAML failures for %s input', async (_label, content, message) => {
    await writeFile(filePath, content);
    const result = await loadSchemas(root, getDefaultStemConfig(root));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected schema failure');
    expect(result.error).toEqual({
      code: 'SCHEMA_LOAD_ERROR', message: `Failed to parse schema YAML at ${filePath}.`,
      path: filePath, cause: expect.any(Error) as unknown
    });
    expect(result.error.cause).toMatchObject({ name: 'YAMLException', message: expect.stringContaining(message) as unknown });
  });

  it.each([
    ['null', 'null'], ['scalar', '42'], ['array', '[]'], ['empty mapping', '{}'],
    ['missing name', 'required: []'], ['numeric name', 'name: 1\nrequired: []'],
    ['null name', 'name: null\nrequired: []'], ['array name', 'name: []\nrequired: []'],
    ['missing required', 'name: api'], ['null required', 'name: api\nrequired: null'],
    ['scalar required', 'name: api\nrequired: endpoint'], ['mapping required', 'name: api\nrequired: {}'],
    ['non-string required entry', 'name: api\nrequired: [endpoint, 1]'],
    ['null required entry', 'name: api\nrequired: [null]'],
    ['numeric description', 'name: api\nrequired: []\ndescription: 1'],
    ['null description', 'name: api\nrequired: []\ndescription: null'],
    ['array description', 'name: api\nrequired: []\ndescription: []']
  ])('preserves shape failures for %s', async (_label, content) => {
    await writeFile(filePath, content);
    expect(await loadSchemas(root, getDefaultStemConfig(root))).toEqual({
      success: false,
      error: {
        code: 'SCHEMA_LOAD_ERROR',
        message: `Schema file ${filePath} must define a string name and a required string array.`,
        path: filePath
      }
    });
  });

  it.each([
    ['empty required', 'name: api\nrequired: []', { name: 'api', required: [] }],
    ['extra fields', 'name: api\nrequired: [endpoint]\ndescription: API\nextra: ignored',
      { name: 'api', required: ['endpoint'], description: 'API' }],
    ['empty strings', 'name: ""\nrequired: [""]\ndescription: ""',
      { name: '', required: [''], description: '' }]
  ] as const)('accepts %s', async (_label, content, expected) => {
    await writeFile(filePath, content);
    expect(await loadSchemas(root, getDefaultStemConfig(root))).toEqual({
      success: true, data: new Map([[expected.name, expected]])
    });
  });

  it('overwrites duplicate names in sorted file order', async () => {
    await writeFile(path.join(root, 'blocks/schemas/z.yml'), 'name: api\nrequired: [last]');
    await writeFile(filePath, 'name: api\nrequired: [first]');
    expect(await loadSchemas(root, getDefaultStemConfig(root))).toEqual({
      success: true, data: new Map([['api', { name: 'api', required: ['last'] }]])
    });
  });
});
