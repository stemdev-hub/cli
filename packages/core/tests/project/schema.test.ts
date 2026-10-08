import * as yaml from 'js-yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeTagSchemaYaml } from '../../src/index.js';

vi.mock('js-yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof yaml>();
  return { ...actual, load: vi.fn(actual.load) };
});

afterEach(() => vi.restoreAllMocks());

describe('decodeTagSchemaYaml', () => {
  it.each([
    ['empty', '', 'expected a document, but the input is empty'],
    ['comment-only', '# comment\n', 'expected a document, but the input is empty'],
    ['malformed', 'name: [\n', 'deficient indentation']
  ])('returns the YAML exception for %s input', (_label, content, message) => {
    const result = decodeTagSchemaYaml(content);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected schema failure');
    expect(result.error).toEqual({ kind: 'yaml', cause: expect.any(Error) as unknown });
    if (result.error.kind !== 'yaml') throw new Error('Expected YAML failure');
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
  ])('rejects %s', (_label, content) => {
    expect(decodeTagSchemaYaml(content)).toEqual({ success: false, error: { kind: 'shape' } });
  });

  it.each([
    ['empty required', 'name: api\nrequired: []', { name: 'api', required: [] }],
    ['extra fields', 'name: api\nrequired: [endpoint]\ndescription: API\nextra: ignored',
      { name: 'api', required: ['endpoint'], description: 'API' }],
    ['empty strings', 'name: ""\nrequired: [""]\ndescription: ""',
      { name: '', required: [''], description: '' }]
  ] as const)('accepts %s', (_label, content, data) => {
    expect(decodeTagSchemaYaml(content)).toEqual({ success: true, data });
  });

  it('copies a frozen YAML payload and its required array', () => {
    // The public input is immutable text; freeze the object produced at the YAML boundary.
    const parsed = Object.freeze({ name: 'api', required: Object.freeze(['endpoint']), description: 'API' });
    vi.mocked(yaml.load).mockReturnValueOnce(parsed);
    const result = decodeTagSchemaYaml('name: api\nrequired: [endpoint]\ndescription: API');
    if (!result.success) throw new Error('Expected valid schema');
    expect(result.data).toEqual(parsed);
    expect(result.data).not.toBe(parsed);
    expect(result.data.required).not.toBe(parsed.required);
    result.data.required.push('response');
    expect(parsed.required).toEqual(['endpoint']);
  });

  it('does not retain the mutable YAML payload or array', () => {
    const parsed = { name: 'api', required: ['endpoint'], description: 'API' };
    vi.mocked(yaml.load).mockReturnValueOnce(parsed);
    const result = decodeTagSchemaYaml('name: api\nrequired: [endpoint]\ndescription: API');
    parsed.name = 'changed';
    parsed.description = 'changed';
    parsed.required.push('response');
    expect(result).toEqual({ success: true, data: { name: 'api', required: ['endpoint'], description: 'API' } });
  });

  it('returns independent results for repeated text input', () => {
    const text = 'name: api\nrequired: [endpoint]';
    const first = decodeTagSchemaYaml(text);
    if (!first.success) throw new Error('Expected valid schema');
    first.data.required.push('response');
    expect(decodeTagSchemaYaml(text)).toEqual({ success: true, data: { name: 'api', required: ['endpoint'] } });
  });

  it('preserves the original thrown cause', () => {
    const cause = new Error('YAML failure');
    vi.mocked(yaml.load).mockImplementationOnce(() => { throw cause; });
    const result = decodeTagSchemaYaml('ignored');
    if (result.success || result.error.kind !== 'yaml') throw new Error('Expected YAML failure');
    expect(result.error.cause).toBe(cause);
  });
});
