import { describe, expect, it } from 'vitest';
import { parseBlockFrontmatter, parseDependencyRef, parseFrontmatter, parseViewFrontmatter } from '../../src/parser/frontmatter.js';

describe('frontmatter characterization', () => {
  it.each([
    ['plain', 'Plain body', {}, 'Plain body', 1],
    ['BOM without fences', '\uFEFFPlain body', {}, 'Plain body', 1],
    ['leading whitespace', ' ---\nid: x\n---\nBody', {}, ' ---\nid: x\n---\nBody', 1],
    ['four dashes', '----\nid: x\n---\nBody', {}, '----\nid: x\n---\nBody', 1],
    ['empty', '---\n---\nEmpty body', {}, 'Empty body', 3],
    ['comments', '---\n# comment\n---\nComment body', {}, 'Comment body', 4],
    ['bare comment', '---\n#\n---\nBare comment', {}, 'Bare comment', 4],
    ['unclosed', '---\nid: unclosed\n', { id: 'unclosed' }, '', 3],
    ['CRLF', '---\r\nid: crlf\r\n---\r\nBody', { id: 'crlf' }, 'Body', 4],
    ['BOM', '\uFEFF---\nid: bom\n---\nBody', { id: 'bom' }, 'Body', 4],
    ['closing suffix', '---\nid: suffix\n---suffix\nBody', { id: 'suffix' }, 'suffix\nBody', 3],
    ['blank body line', '---\nid: blank\n---\n\nBody', { id: 'blank' }, '\nBody', 4],
    ['yaml tag', '---yaml\nid: yaml\n---\nBody', { id: 'yaml' }, 'Body', 4],
    ['yml tag', '---yml\nid: yml\n---\nBody', { id: 'yml' }, 'Body', 4],
    ['uppercase YAML tag', '---YAML\nid: upper\n---\nBody', { id: 'upper' }, 'Body', 4],
    ['null', '---\nnull\n---\nNull body', {}, 'Null body', 4],
    ['tilde', '---\n~\n---\nTilde body', {}, 'Tilde body', 4],
    ['scalar', '---\nhello\n---\nScalar body', 'hello', 'Scalar body', 4],
    ['number', '---\n42\n---\nNumber body', 42, 'Number body', 4],
    ['false', '---\nfalse\n---\nBoolean body', false, 'Boolean body', 4],
    ['array', '---\n- one\n- two\n---\nArray body', ['one', 'two'], 'Array body', 5]
  ])('preserves %s extraction', (_name, content, data, body, bodyStartLine) => {
    expect(parseFrontmatter(content)).toEqual({ data, body, bodyStartLine, errors: [] });
  });

  it.each([
    ['LF', '---\nid: [characterization\n---\n\nBody', '\n\nBody', 3],
    ['CRLF', '---\r\nid: [characterization\r\n---\r\nBody', '\r\nBody', 3],
    ['BOM', '\uFEFF---\nid: [characterization\n---\nBody', '\uFEFF---\nid: [characterization\n---\nBody', 1],
    ['unclosed', '---\nid: [unclosed-characterization', '---\nid: [unclosed-characterization', 1],
    ['duplicate key', '---\nid: first\nid: second\n---\nBody', '\nBody', 4],
    ['unknown tag', '---\nid: !custom characterization\n---\nBody', '\nBody', 3]
  ])('preserves %s diagnostic and recovery', (_name, content, body, bodyStartLine) => {
    expect(parseFrontmatter(content, '/project/blocks/test.md', 'blocks/test.md')).toEqual({
      data: {}, body, bodyStartLine,
      errors: [{ code: 'INVALID_FRONTMATTER', severity: 'error', message: 'Frontmatter could not be parsed.',
        filePath: '/project/blocks/test.md', relativePath: 'blocks/test.md',
        context: { parseError: expect.any(String) as unknown } }]
    });
  });

  it('preserves multiline, quoted strings, and core explicit tags', () => {
    const result = parseFrontmatter('---\nliteral: |\n  hello\n  world\nfolded: >\n  hello\n  world\nsingle: \'a: b\'\ndouble: "hello\\nworld"\nnumber: !!str 123\ninteger: !!int "42"\n---\nStrings');
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({ literal: 'hello\nworld\n', folded: 'hello world\n', single: 'a: b', double: 'hello\nworld', number: '123', integer: 42 });
  });

  it('expands merge keys with explicit values taking precedence', () => {
    const result = parseFrontmatter('---\nbase: &base {id: inherited, tags: [base]}\n<<: *base\nid: explicit\n---\nMerge');
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({ base: { id: 'inherited', tags: ['base'] }, id: 'explicit', tags: ['base'] });
  });

  it('preserves date objects and their filtering from Stem string fields', () => {
    const result = parseFrontmatter('---\ndate: 2024-01-02\ntime: 2024-01-02T03:04:05Z\n---\nDates');
    expect(result.data).toEqual({ date: new Date('2024-01-02'), time: new Date('2024-01-02T03:04:05Z') });
    const block = parseBlockFrontmatter('---\nid: 2024-01-02\ntags: [2024-01-02, "2024-01-02"]\ndepends-on: [2024-01-02, "2024-01-02"]\n---\nDate fields', 'block.md', 'block.md');
    expect(block.data).toEqual({ id: '', tags: ['2024-01-02'], dependsOn: [{ blockId: '2024-01-02', section: null, tag: null, raw: '2024-01-02' }] });
    expect(block.errors[0]?.message).toBe('Missing required frontmatter field: id.');
    const view = parseViewFrontmatter('---\nid: date-view\ngroup: 2024-01-02\n---\nDate group', 'view.md', 'view.md');
    expect(view.data.group).toBeNull();
  });
});

describe('YAML core schema policy', () => {
  it.each([
    ['012', 12], ['0o12', 10], ['1:20', '1:20']
  ])('decodes %s using YAML 1.2 numbers', (yaml, expected) => {
    const parsed = parseFrontmatter(`---\nvalue: ${yaml}\n---\nNumeric policy`);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toEqual({ value: expected });
  });

  it.each(['json', 'js', 'javascript', 'toml'])('rejects the %s engine', (engine) => {
    const parsed = parseFrontmatter(`---${engine}\n{}\n---\nEngine body`, 'engine.md', 'engine.md');
    expect(parsed).toEqual({ data: {}, body: '\nEngine body', bodyStartLine: 3,
      errors: [{ code: 'INVALID_FRONTMATTER', severity: 'error', message: 'Frontmatter could not be parsed.',
        filePath: 'engine.md', relativePath: 'engine.md',
        context: { parseError: `Unsupported frontmatter language "${engine}". Only YAML is supported.` } }] });
  });

  it.each(['!!set {a: null}', '!!binary SGVsbG8=', '!!omap [{a: 1}]', '!!pairs [{a: 1}]'])('rejects unsupported YAML %s', (yaml) => {
    const parsed = parseFrontmatter(`---\nvalue: ${yaml}\n---\nUnsupported tag`, 'tag.md', 'tag.md');
    expect(parsed).toEqual({ data: {}, body: '\nUnsupported tag', bodyStartLine: 3,
      errors: [{ code: 'INVALID_FRONTMATTER', severity: 'error', message: 'Frontmatter could not be parsed.',
        filePath: 'tag.md', relativePath: 'tag.md', context: { parseError: expect.stringContaining('unknown') as unknown } }] });
  });
});

describe('parseBlockFrontmatter', () => {
  it('extracts block id, tags, and dependencies', () => {
    const result = parseBlockFrontmatter(
      `---
id: auth-flow-block
tags: [auth, backend]
depends-on:
  - users-table-block
---

Body`,
      '/project/blocks/auth.md',
      'blocks/auth.md'
    );

    expect(result.errors).toEqual([]);
    expect(result.data.id).toBe('auth-flow-block');
    expect(result.data.tags).toEqual(['auth', 'backend']);
    expect(result.data.dependsOn).toEqual([
      { blockId: 'users-table-block', section: null, tag: null, raw: 'users-table-block' }
    ]);
    expect(result.body.trim()).toBe('Body');
  });

  it('returns an error on malformed YAML without throwing', () => {
    const result = parseBlockFrontmatter(
      `---
id: [broken
---

Body`,
      '/project/blocks/broken.md',
      'blocks/broken.md'
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe('INVALID_FRONTMATTER');
  });

  it('returns an error on missing required id', () => {
    const result = parseBlockFrontmatter(
      `---
tags: [auth]
---

Body`,
      '/project/blocks/missing.md',
      'blocks/missing.md'
    );

    expect(result.data.id).toBe('');
    expect(result.errors[0]?.code).toBe('INVALID_FRONTMATTER');
  });

  it('parses scoped dependency syntax', () => {
    expect(parseDependencyRef('block-id#section.tag')).toEqual({
      blockId: 'block-id',
      section: 'section',
      tag: 'tag',
      raw: 'block-id#section.tag'
    });
  });
});

describe('parseViewFrontmatter', () => {
  it('extracts view id and group', () => {
    const result = parseViewFrontmatter(
      `---
id: auth-service-view
group: by-audience/backend
---

Body`,
      '/project/views/auth.md',
      'views/auth.md'
    );

    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({
      id: 'auth-service-view',
      group: 'by-audience/backend'
    });
  });
});
