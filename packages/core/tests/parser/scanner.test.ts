import { describe, expect, it } from 'vitest';
import { parse } from '../../src/parser/scanner.js';
import type { BlockSyntax, SyntaxNode } from '../../src/parser/syntax.js';

const scan = (content: string) => parse({ sourceId: 'buffer:example', content });
const block = (node: SyntaxNode | undefined): BlockSyntax => {
  if (node?.kind !== 'block') throw new Error('Expected a Block');
  return node;
};
const nodes = (roots: readonly SyntaxNode[]): SyntaxNode[] => {
  const result: SyntaxNode[] = [];
  const pending = [...roots].reverse();
  while (pending.length > 0) {
    const node = pending.pop()!;
    result.push(node);
    if (node.kind === 'block') {
      for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]!);
    }
  }
  return result;
};

describe('source and syntax ownership', () => {
  it('retains surrounding content, roots, children and exact editable UTF-16 ranges', () => {
    const content = '😀before@stem:block(tags:[guide] id: A_1)body@stem:block(id:-)child@stem:end(id:-)@stem:include(lib-2:A_1)@stem:end(id:A_1)after';
    const result = scan(content);
    expect(result.diagnostics).toEqual([]);
    expect(result.tree.source).toEqual({ sourceId: 'buffer:example', content });
    const parent = block(result.tree.children[1]);
    expect(parent.range.startOffset).toBe(8);
    expect(parent.header.fields.map(field => field.name)).toEqual(['tags', 'id']);
    const idRange = parent.header.fields[1]!.valueRange!;
    expect(content.slice(idRange.startOffset, idRange.endOffset)).toBe('A_1');
    const child = block(parent.children[1]);
    expect(child.ending).toMatchObject({ kind: 'marker', id: '-' });
    const inclusion = parent.children[2]!;
    expect(inclusion).toMatchObject({ kind: 'include', target: { qualifier: 'lib-2', id: 'A_1' } });
    if (inclusion.kind === 'include') {
      expect(content.slice(inclusion.target.idRange.startOffset, inclusion.target.idRange.endOffset)).toBe('A_1');
    }
    if (parent.ending.kind === 'marker') {
      expect(content.slice(parent.ending.idRange!.startOffset, parent.ending.idRange!.endOffset)).toBe('A_1');
    }
    expect(result.tree.children[2]).toMatchObject({ kind: 'text', value: 'after' });
  });

  it('copies input records and returns frozen records without affecting earlier evaluations', () => {
    const source = { sourceId: 'one', content: '@stem:block(id:a)A@stem:end()' };
    const result = parse(source);
    source.content = 'changed';
    source.sourceId = 'two';
    scan('a later evaluation');
    expect(result.tree.source).toEqual({ sourceId: 'one', content: '@stem:block(id:a)A@stem:end()' });
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.tree.children)).toBe(true);
    expect(Object.isFrozen(block(result.tree.children[0]).header.fields[0])).toBe(true);
    expect(() => Object.assign(result.tree.source, { content: 'mutation' })).toThrow();
  });

  it.each(['\n', '\r\n', '\r'])('keeps %j boundary newlines for composition to interpret', ending => {
    const content = `@stem:block(id:a)${ending}A${ending}@stem:end()${ending}`;
    const result = scan(content);
    const definition = block(result.tree.children[0]);
    expect(definition.children).toMatchObject([{ kind: 'text', value: `${ending}A${ending}` }]);
    expect(result.tree.children[1]).toMatchObject({ kind: 'text', value: ending });
    expect(result.diagnostics).toEqual([]);
  });

  it('does not normalize mixed line endings, trim content or infer ownership from headings', () => {
    const content = '---\r\nid: frontmatter\n---\r@stem:block(id:a) \n# heading\r\n\tA\r@stem:end()\n';
    const result = scan(content);
    expect(result.tree.children[0]).toMatchObject({ kind: 'text', value: '---\r\nid: frontmatter\n---\r' });
    expect(block(result.tree.children[1]).children).toMatchObject([{ value: ' \n# heading\r\n\tA\r' }]);
    expect(result.diagnostics).toEqual([]);
  });

  it.each([
    '```md\n%s\n```', '`%s`', '    %s', '<!-- %s -->', '<script>%s</script>',
    '[link](%s)', '![%s](url)', '> %s', '---\nid: %s\n---', '# title %s', 'left%sright'
  ])('recognizes directives uniformly in %s', wrapper => {
    const result = scan(wrapper.replace('%s', '@stem:block(id:a)@stem:include(b)@stem:end()'));
    expect(result.diagnostics).toEqual([]);
    expect(nodes(result.tree.children).filter(node => node.kind === 'block')).toHaveLength(1);
    expect(nodes(result.tree.children).filter(node => node.kind === 'include')).toHaveLength(1);
  });
});

describe('inclusions and escaping', () => {
  it.each(['a', 'A', '0', '-', '_', '-0_A', 'other-project:A_0'])('accepts target %s', target => {
    const result = scan(`@stem:include( \t${target}\t )`);
    expect(result.diagnostics).toEqual([]);
    expect(result.tree.children[0]).toMatchObject({ kind: 'include' });
  });

  it.each(['', '#a', 'a.b', 'a b', 'UP:a', '_x:a', 'x--y:a', '-x:a', 'x-:a', 'x :a', 'x: a', 'x:y:z', 'id:a extra', 'é', 'a\u2028b'])('rejects target %j without inventing a reference', target => {
    const content = `@stem:include(${target})`;
    const result = scan(content);
    expect(result.tree.children).toMatchObject([{ kind: 'error', value: content }]);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['INVALID_STEM_INSTRUCTION']);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])('interprets a run of %i backslashes once', count => {
    const original = `${'\\'.repeat(count)}@stem:include(a)`;
    const result = scan(original);
    expect(result.diagnostics).toEqual([]);
    const text = result.tree.children.filter(node => node.kind === 'text').map(node => node.value).join('');
    expect(text).toBe('\\'.repeat(Math.floor(count / 2)) + (count % 2 ? '@stem:include(a)' : ''));
    expect(result.tree.children.filter(node => node.kind === 'include')).toHaveLength(count % 2 ? 0 : 1);
    expect(result.tree.children[0]!.range.startOffset).toBe(0);
    expect(result.tree.children.at(-1)!.range.endOffset).toBe(original.length);
  });

  it('does not let an escaped opener protect its closer or a later marker', () => {
    const result = scan('\\@stem:block(id:a)@stem:end()@stem:include(b)');
    expect(result.tree.children.map(node => node.kind)).toEqual(['text', 'error', 'include']);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['UNMATCHED_BLOCK_END']);
  });

  it('leaves backslashes elsewhere untouched, and slash does not escape a marker', () => {
    const result = scan('\\ordinary\\@other:include(a)/@stem:include(a)tail\\');
    expect(result.tree.children).toMatchObject([
      { kind: 'text', value: '\\ordinary\\@other:include(a)/' }, { kind: 'include' }, { kind: 'text', value: 'tail\\' }
    ]);
  });
});

describe('metadata and Tags', () => {
  it('keeps field occurrences, unknown fields and repeated fields without choosing identity', () => {
    const result = scan('@stem:block(id:a id:b unknown:value tags:[x] tags:[y])body@stem:end(id:a)');
    const definition = block(result.tree.children[0]);
    expect(definition.header.fields.map(field => field.name)).toEqual(['id', 'id', 'unknown', 'tags', 'tags']);
    expect(definition.ending.kind).toBe('eof');
    expect(definition.children.at(-1)).toMatchObject({ kind: 'error', value: '@stem:end(id:a)' });
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'REPEATED_BLOCK_FIELD', 'UNKNOWN_BLOCK_FIELD', 'REPEATED_BLOCK_FIELD', 'UNMATCHED_BLOCK_END', 'MISSING_BLOCK_END'
    ]);
    expect(result.diagnostics[0]!.related).toHaveLength(1);
  });

  it.each(['id:', 'id:a.b', 'id:"a"', 'id :a', 'tags:[]', 'id:a tags:[x]id:b'])('reports invalid metadata %s and still parses children', fields => {
    const result = scan(`@stem:block(${fields})@stem:block(id:child)C@stem:end()@stem:end()`);
    const parent = block(result.tree.children[0]);
    expect(parent.diagnostics.length).toBeGreaterThan(0);
    const child = block(parent.children[0]);
    expect(child.diagnostics).toEqual([]);
    expect(child.header.fields[0]).toMatchObject({ id: 'child', valid: true });
  });

  it('does not consume the next field as a missing ID value', () => {
    const result = scan('@stem:block(id: tags:[guide])@stem:end()');
    const definition = block(result.tree.children[0]);
    expect(definition.header.fields).toMatchObject([
      { name: 'id', valid: false }, { name: 'tags', tags: [{ value: 'guide' }] }
    ]);
    expect(definition.header.fields[0]).not.toHaveProperty('valueRange');
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['INVALID_BLOCK_ID']);
  });

  it('decodes whole JSON strings, preserving spelling, spaces, delimiters and literal markers', () => {
    const names = ['with,comma', 'with]bracket', 'quote"slash\\', 'paren(name)', '@stem:end()', 'é', 'e\u0301', 'true', 'two words'];
    const result = scan(`@stem:block(tags:[${names.map(name => JSON.stringify(name)).join(',')}] id:a)@stem:end()`);
    const field = block(result.tree.children[0]).header.fields[0]!;
    expect(field.tags!.map(tag => tag.value)).toEqual(names);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['DUPLICATE_TAG']);
    expect(result.diagnostics[0]).toMatchObject({ severity: 'warning' });
  });

  it('treats parentheses and marker-shaped text within unquoted Tags as data', () => {
    const result = scan('@stem:block(id:a tags:[@stem:end(), two words, (api)])body@stem:end()');
    expect(result.diagnostics).toEqual([]);
    expect(block(result.tree.children[0]).header.fields[1]!.tags!.map(tag => tag.value))
      .toEqual(['@stem:end()', 'two words', '(api)']);
  });

  it.each(['[guide,]', '[,guide]', '[guide,,api]', '["x"suffix,good]', '[bad\\name,good]', '[bad[name,good]', '["\\q",good]', '["",good]', '[" x",good]', '["x ",good]', '["x\\n",good]', '["x\\u0000",good]', '["x\\u0085",good]', '["x\\u2028",good]', 'guide'])('reports malformed Tag list %s while retaining usable body', tags => {
    const result = scan(`@stem:block(id:a tags:${tags})BODY@stem:end()`);
    const definition = block(result.tree.children[0]);
    expect(definition.header.terminated).toBe(true);
    expect(definition.header.fields[0]).toMatchObject({ id: 'a', valid: true });
    expect(definition.header.fields[1]!.valid).toBe(false);
    expect(definition.children).toMatchObject([{ kind: 'text', value: 'BODY' }]);
    expect(result.diagnostics.some(diagnostic => diagnostic.code === 'INVALID_TAG_LIST')).toBe(true);
  });

  it('retains known entries from a malformed single field and keeps empty lists valid', () => {
    const result = scan('@stem:block(id:a tags:[guide,"bad"suffix,api,])@stem:end()@stem:block(id:b tags:[])@stem:end()');
    expect(block(result.tree.children[0]).header.fields[1]!.tags!.map(tag => tag.value)).toEqual(['guide', 'api']);
    expect(block(result.tree.children[1]).header.fields[1]).toMatchObject({ valid: true, tags: [] });
  });
});

describe('localized recovery', () => {
  it.each(['@stem:wat(a)', '@stem:include a)', '@stem:block (id:a)', '@stem:end(id:)', '@stem:end(id:a extra)'])('preserves %s literally without ownership or inclusion', malformed => {
    const result = scan(`${malformed}@stem:block(id:b)B@stem:end()`);
    expect(result.tree.children[0]).toMatchObject({ kind: 'error', value: malformed });
    expect(block(result.tree.children[1]).header.fields[0]!.id).toBe('b');
    expect(result.diagnostics).toHaveLength(1);
  });

  it.each(['\n', '\r', '\r\n'])('leaves a %j line ending after a failed fragment intact', ending => {
    const result = scan(`@stem:include(broken${ending}@stem:include(good)`);
    expect(result.tree.children).toMatchObject([
      { kind: 'error', value: '@stem:include(broken' }, { kind: 'text', value: ending }, { kind: 'include', target: { id: 'good' } }
    ]);
  });

  it('leaves the next active marker for scanning and ignores escaped prefixes within failed fragments', () => {
    const result = scan('@stem:wrong\\@stem:literal@stem:include(good)');
    expect(result.tree.children).toMatchObject([
      { kind: 'error', value: '@stem:wrong\\@stem:literal' }, { kind: 'include', target: { id: 'good' } }
    ]);
    expect(scan('@stem:wrong\\\\@stem:include(good)').tree.children).toMatchObject([
      { kind: 'error', value: '@stem:wrong\\\\' }, { kind: 'include' }
    ]);
  });

  it.each(['id:a tags:[guide', 'id:a tags:["unfinished', 'id:a tags:[@stem:block(id:fake)'])('bounds unfinished headers by their original line: %s', metadata => {
    const opener = `@stem:block(${metadata}`;
    const result = scan(`${opener}\r\nA@stem:block(id:child)C@stem:end()\n@stem:end(id:a)`);
    const parent = block(result.tree.children[0]);
    expect(parent.header).toMatchObject({ terminated: false, range: { startOffset: 0, endOffset: opener.length } });
    expect(parent.children.map(node => node.kind)).toEqual(['text', 'block', 'text']);
    expect(parent.children[0]).toMatchObject({ value: '\r\nA' });
    expect(parent.ending.kind).toBe('marker');
    expect(block(parent.children[1]).diagnostics).toEqual([]);
    expect(nodes(result.tree.children).filter(node => node.kind === 'block')).toHaveLength(2);
  });

  it('recovers EOF without synthesizing markers or trimming trailing content', () => {
    const result = scan('@stem:block(id:a)\nA\n\t');
    const definition = block(result.tree.children[0]);
    expect(definition.ending).toEqual({ kind: 'eof', offset: result.tree.source.content.length });
    expect(definition.children).toMatchObject([{ kind: 'text', value: '\nA\n\t' }]);
    expect(definition.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['MISSING_BLOCK_END']);
  });

  it('ends intervening Blocks implicitly when an unambiguous ancestor closer appears', () => {
    const content = '@stem:block(id:a)@stem:block(id:b)B \n@stem:end(id:a)';
    const result = scan(content);
    const parent = block(result.tree.children[0]);
    const child = block(parent.children[0]);
    expect(parent.ending.kind).toBe('marker');
    expect(parent.diagnostics).toEqual([]);
    expect(child.ending).toEqual({ kind: 'ancestor', offset: content.indexOf('@stem:end') });
    expect(child.children).toMatchObject([{ value: 'B \n' }]);
    expect(child.diagnostics[0]!.code).toBe('MISSING_BLOCK_END');
    expect(child.diagnostics[0]!.related![0]!.range.startOffset).toBe(content.indexOf('@stem:end'));
  });

  it('does not choose between ambiguous ancestors but accepts an exact innermost match', () => {
    const result = scan('@stem:block(id:a)@stem:block(id:a)@stem:block(id:b)@stem:end(id:a)@stem:end()@stem:end(id:a)@stem:end(id:a)');
    const parent = block(result.tree.children[0]);
    const middle = block(parent.children[0]);
    const inner = block(middle.children[0]);
    expect(inner.children[0]).toMatchObject({ kind: 'error', value: '@stem:end(id:a)' });
    expect([parent, middle, inner].map(node => node.ending.kind)).toEqual(['marker', 'marker', 'marker']);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['UNMATCHED_BLOCK_END']);
  });

  it('matches labelled IDs exactly and malformed closers leave ownership open', () => {
    const result = scan('@stem:block(id:A)@stem:end(id:a)@stem:end(id:)@stem:block(id:c)C@stem:end()@stem:end(id:A)');
    const parent = block(result.tree.children[0]);
    expect(parent.children.map(node => node.kind)).toEqual(['error', 'error', 'block']);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['UNMATCHED_BLOCK_END', 'INVALID_STEM_INSTRUCTION']);
  });
});

describe('bounded traversal and progress', () => {
  it('handles deep trees, ancestor recovery and unmatched labels without recursive walks', () => {
    const depth = 12_000;
    const openers = Array.from({ length: depth }, (_, index) => `@stem:block(id:b${index})`).join('');
    const result = scan(openers + '@stem:end(id:absent)'.repeat(depth) + '@stem:end(id:b0)');
    const all = nodes(result.tree.children);
    expect(all.filter(node => node.kind === 'block')).toHaveLength(depth);
    expect(result.diagnostics.filter(diagnostic => diagnostic.code === 'MISSING_BLOCK_END')).toHaveLength(depth - 1);
    expect(result.diagnostics.filter(diagnostic => diagnostic.code === 'UNMATCHED_BLOCK_END')).toHaveLength(depth);
    expect(block(result.tree.children[0]).ending.kind).toBe('marker');
  }, 10_000);

  it('terminates on adversarial fragments and keeps every node range within its owner', () => {
    const fragments = ['@stem:', '@stem:include(', '@stem:block(', '@stem:end(id:)', ')', 'tags:["', '\\', '\r\n', '😀', '@stem:block(id:a)', '@stem:end()', ' ', 'id: tags:'];
    let state = 17;
    for (let trial = 0; trial < 150; trial++) {
      let content = '';
      for (let i = 0; i < 35; i++) {
        state = (state * 1664525 + 1013904223) >>> 0;
        content += fragments[state % fragments.length];
      }
      const result = scan(content);
      const pending = [{ children: result.tree.children, start: 0, end: content.length }];
      while (pending.length > 0) {
        const owner = pending.pop()!;
        let previousEnd = owner.start;
        for (const node of owner.children) {
          expect(node.range.startOffset).toBeGreaterThanOrEqual(previousEnd);
          expect(node.range.endOffset).toBeGreaterThan(node.range.startOffset);
          expect(node.range.endOffset).toBeLessThanOrEqual(owner.end);
          if (node.kind === 'block') pending.push({ children: node.children, start: node.header.range.endOffset, end: node.range.endOffset });
          previousEnd = node.range.endOffset;
        }
      }
      for (const diagnostic of result.diagnostics) {
        expect(diagnostic.location!.sourceId).toBe('buffer:example');
        expect(diagnostic.location!.range.endOffset).toBeLessThanOrEqual(content.length);
      }
    }
  });
});
