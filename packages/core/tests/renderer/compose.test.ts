import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../../src/project/analysis.js';
import type { InstanceInput, ProjectAnalysis } from '../../src/project/model.js';
import { compose } from '../../src/renderer/compose.js';
import type { CompositionLimits, CompositionTarget } from '../../src/renderer/compose.js';

const limits = { maxWork: 100_000, maxOutputBytes: 16 * 1024 * 1024 };
const block = (id: string, body = '', metadata = '') => `@stem:block(id:${id}${metadata})${body}@stem:end()`;
const include = (ref: string) => `@stem:include(${ref})`;
const analyze = (content: string) => {
  const handle = {};
  return analyzeProject({ localInstance: handle, instances: [{ handle, sources: [{ sourceId: 'doc', content }] }] });
};
const fileTarget = (analysis: ProjectAnalysis): CompositionTarget => ({
  kind: 'file', instance: analysis.localInstance!, sourceId: 'doc'
});
const blockTarget = (analysis: ProjectAnalysis, id = 'a'): CompositionTarget => ({
  kind: 'block', instance: analysis.localInstance!, reference: { id }
});
const render = (content: string, id?: string, budget = limits) => {
  const analysis = analyze(content);
  return compose(analysis, id === undefined ? fileTarget(analysis) : blockTarget(analysis, id), budget);
};
const codes = (result: ReturnType<typeof compose>) => result.diagnostics.map(diagnostic => diagnostic.code);

describe('private composition content', () => {
  it('emits definitions, children, free text and every inclusion in authored order', () => {
    const input = 'L' + block('a', 'A' + block('b', 'B') + 'C') + 'R' + include('a');
    expect(render(input)).toEqual({ content: 'LABCRABC', complete: true, diagnostics: [] });
    expect(render(input, 'a').content).toBe('ABC');
    expect(render(input, 'b').content).toBe('B');
  });

  it('preserves frontmatter, Markdown placement, indentation and final whitespace', () => {
    const input = '---\nid: old\n---\n# ' + include('a') + '\n```\n' + include('a') + '\n```\n  '
      + block('a', 'x\n y\t');
    expect(render(input).content).toBe('---\nid: old\n---\n# x\n y\t\n```\nx\n y\t\n```\n  x\n y\t');
    expect(render(input, 'a').content).toBe('x\n y\t');
  });

  it.each(['\n', '\r\n', '\r'])('removes exactly one boundary line ending: %j', newline => {
    expect(render('L' + block('a', newline + 'X' + newline) + 'R').content).toBe('LXR');
    expect(render(block('a', newline + newline + 'X' + newline + newline), 'a').content)
      .toBe(newline + 'X' + newline);
    expect(render(block('a', newline), 'a').content).toBe('');
    expect(render(block('a', ''), 'a').content).toBe('');
    expect(render(block('a', newline) + newline + block('b', newline)).content).toBe(newline);
  });

  it.each([
    ['\nX', 'X'], ['X\n', 'X'], [' \nX\n\t', ' \nX\n\t'],
    ['\r\nX\r', 'X'], ['\n\r\n', ''], ['\n\n\n', '\n']
  ])('evaluates each boundary independently for %j', (body, expected) => {
    expect(render(block('a', body), 'a').content).toBe(expected);
  });

  it('propagates actual ancestor newline removal through implicitly ended children', () => {
    const input = '@stem:block(id:a)\nA@stem:block(id:b)\nB\r\n@stem:end(id:a)\nZ';
    expect(render(input).content).toBe('AB\nZ');
    expect(render(input, 'a').content).toBe('AB');
    expect(render(input, 'b').content).toBe('B\r\n');
    expect(codes(render(input, 'b'))).toContain('MISSING_BLOCK_END');
  });

  it('does not remove EOF whitespace or let an enclosing boundary trim an inclusion', () => {
    expect(render('@stem:block(id:a)\nX\n', 'a').content).toBe('X\n');
    expect(render(block('a', '\n' + include('b') + '\n') + block('b', 'X\n '), 'a').content).toBe('X\n ');
  });

  it('consumes Stem escapes only once, including through repeated inclusion', () => {
    const literal = String.raw`\@stem:include(missing)`;
    const input = block('a', literal) + block('b', include('a') + include('a'));
    expect(render(input, 'b')).toEqual({ content: '@stem:include(missing)@stem:include(missing)', complete: true, diagnostics: [] });
    expect(render(block('a', String.raw`\\@stem:include(b)`) + block('b', 'B'), 'a').content).toBe('\\B');
  });

  it('does not recognize instructions assembled from separate fragments', () => {
    const input = block('a', '@st') + block('b', 'em:include(missing)') + block('root', include('a') + include('b'));
    expect(render(input, 'root')).toEqual({ content: '@stem:include(missing)', complete: true, diagnostics: [] });
  });

  it('clips boundary newlines against original ranges even when escapes shorten the text', () => {
    const literal = String.raw`\@stem:include(missing)`;
    expect(render(block('a', '\r\n' + literal + '\r\n'), 'a').content).toBe('@stem:include(missing)');
    expect(render('@stem:block(id:a)\n@stem:block(id:b)\n' + literal + '\n@stem:end(id:a)', 'a').content)
      .toBe('@stem:include(missing)');
  });
});

describe('composition recovery and diagnostic scope', () => {
  it.each(['@stem:include(bad id)', '@stem:wat()', '@stem:end()', '@stem:include missing)'])(
    'retains failed syntax literally and continues: %s', broken => {
      const result = render('L' + broken + 'R');
      expect(result.content).toBe('L' + broken + 'R');
      expect(result.complete).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.location).toMatchObject({ sourceId: 'doc', range: { startOffset: 1 } });
    });

  it('emits an unfinished header exactly once, with usable body and children', () => {
    const input = 'L@stem:block(id:a tags:[bad\nBody' + block('child', 'C') + '\n@stem:end()R';
    const result = render(input);
    expect(result.content).toBe('L@stem:block(id:a tags:[bad\nBodyCR');
    expect(result.complete).toBe(false);
    expect(codes(result)).toContain('UNFINISHED_BLOCK_HEADER');
    expect(render(input, 'child')).toEqual({ content: 'C', complete: true, diagnostics: [] });
  });

  it('separates complete body content from invalid metadata and duplicate IDs', () => {
    const result = render(block('a', 'A', ' tags:[,]') + block('a', 'B'));
    expect(result.content).toBe('AB');
    expect(result.complete).toBe(true);
    expect(codes(result)).toContain('INVALID_TAG_LIST');
    expect(codes(result).filter(code => code === 'DUPLICATE_BLOCK_ID')).toHaveLength(1);
  });

  it('retains a resolved erroneous target and excludes unrelated or ancestor errors', () => {
    const input = block('parent', block('a', 'A'), ' unknown:bad') + block('bad', include('missing'));
    expect(render(input, 'a')).toEqual({ content: 'A', complete: true, diagnostics: [] });
    const parent = render(input, 'parent');
    expect(parent).toMatchObject({ content: 'A', complete: true });
    expect(codes(parent)).toEqual(['UNKNOWN_BLOCK_FIELD']);
    const included = render(input + block('root', include('parent')), 'root');
    expect(codes(included)).toEqual(['UNKNOWN_BLOCK_FIELD']);
  });

  it('keeps descendant errors and de-duplicates authored metadata diagnostics on repeated use', () => {
    const result = render(block('a', include('b') + include('b')) + block('b', 'B', ' tags:[bad,]'), 'a');
    expect(result).toMatchObject({ content: 'BB', complete: true });
    expect(codes(result)).toEqual(['INVALID_TAG_LIST']);
  });

  it('omits missing and ambiguous inclusions, preserves surrounding text and continues', () => {
    const input = block('root', 'L' + include('missing') + 'M' + include('a') + 'R') + block('a', 'A') + block('a', 'B');
    const result = render(input, 'root');
    expect(result).toMatchObject({ content: 'LMR', complete: false });
    expect(codes(result)).toEqual(['BLOCK_NOT_FOUND', 'AMBIGUOUS_BLOCK_REFERENCE']);
    expect(result.diagnostics[1]!.related).toHaveLength(2);
  });

  it('rejects a missing or ambiguous root without choosing a definition', () => {
    expect(render('', 'a')).toMatchObject({ content: '', complete: false });
    expect(codes(render(block('a', 'A') + block('a', 'B'), 'a'))).toEqual(['AMBIGUOUS_BLOCK_REFERENCE']);
  });

  it('does not import output-usage warnings into selected content', () => {
    const handle = {};
    const analysis = analyzeProject({ localInstance: handle,
      instances: [{ handle, sources: [{ sourceId: 'doc', content: block('a', 'A') + block('unused', 'U') }] }],
      outputs: { complete: true, targets: [{ kind: 'block', reference: { id: 'a' } }] } });
    expect(analysis.diagnostics.some(diagnostic => diagnostic.code === 'ORPHANED_BLOCK')).toBe(true);
    expect(compose(analysis, blockTarget(analysis, 'unused'), limits)).toEqual({ content: 'U', complete: true, diagnostics: [] });
  });

  it('does not turn warnings into incomplete content', () => {
    const result = render(block('a', 'A', ' tags:[guide,guide]'), 'a');
    expect(result).toMatchObject({ content: 'A', complete: true });
    expect(result.diagnostics.map(diagnostic => diagnostic.severity)).toEqual(['warning']);
  });
});

describe('composition instances and expansion paths', () => {
  const connected = (localContent: string, remoteContent: string, extra: Partial<InstanceInput> = {}) => {
    const local = {}, remote = {};
    return analyzeProject({ localInstance: local, instances: [
      { handle: local, sources: [{ sourceId: 'doc', content: localContent }], bindings: [{ alias: 'lib', target: remote }] },
      { handle: remote, sources: [{ sourceId: 'doc', content: remoteContent }], bindings: [{ alias: 'back', target: local }], ...extra }
    ] });
  };

  it('resolves nested aliases from source-owned contexts and distinguishes the same ID', () => {
    const analysis = connected(block('a', 'L' + include('lib:a')), block('a', 'R' + include('back:b')));
    const result = compose(analysis, blockTarget(analysis), limits);
    expect(result).toMatchObject({ content: 'LR', complete: false });
    expect(codes(result)).toEqual(['BLOCK_NOT_FOUND']);
    expect(result.diagnostics[0]!.location!.instance).toBe(analysis.instances[1]!.handle);
  });

  it('permits separate completed paths and stops only the cyclic occurrence', () => {
    const input = block('a', 'L' + include('b') + include('b') + 'R') + block('b', 'B' + include('a') + 'C');
    const result = render(input, 'a');
    expect(result).toMatchObject({ content: 'LBCBCR', complete: false });
    expect(codes(result)).toEqual(['BLOCK_CYCLE', 'BLOCK_CYCLE']);
  });

  it('detects containment re-entry and preserves later independent text', () => {
    const result = render(block('a', 'A' + block('child', 'B' + include('a') + 'C') + 'D'), 'a');
    expect(result).toMatchObject({ content: 'ABCD', complete: false });
    expect(codes(result)).toEqual(['BLOCK_CYCLE']);
    expect(result.diagnostics[0]!.related).toHaveLength(3);
  });

  it('detects finite alias revisits and localizes the actual closing occurrence', () => {
    const analysis = connected(block('a', 'L' + include('lib:a') + 'Z'), block('a', 'R' + include('back:a') + 'S'));
    const result = compose(analysis, blockTarget(analysis), limits);
    expect(result).toMatchObject({ content: 'LRSZ', complete: false });
    expect(codes(result)).toEqual(['BLOCK_CYCLE']);
    expect(result.diagnostics[0]!.location!.instance).toBe(analysis.instances[1]!.handle);
  });

  it('does not copy graph-wide cycle diagnostics into an expansion stopped before that occurrence', () => {
    const analysis = analyze(block('a', 'A' + include('b')) + block('b', 'B' + include('a')));
    expect(analysis.diagnostics.some(diagnostic => diagnostic.code === 'BLOCK_CYCLE')).toBe(true);
    const result = compose(analysis, blockTarget(analysis, 'b'), { maxWork: 1, maxOutputBytes: 100 });
    expect(result.content).toBe('B');
    expect(codes(result)).toEqual(['COMPOSITION_WORK_LIMIT']);
  });

  it.each([
    { sources: undefined }, { sourcesComplete: false },
    { bindings: [{ alias: 'back', unavailable: 'invalid-configuration' as const }] }
  ])('retains unavailable-context causes: %j', extra => {
    const analysis = connected(block('a', 'L' + include('lib:a') + 'Z'), block('a', 'R' + include('back:a')), extra);
    const result = compose(analysis, blockTarget(analysis), limits);
    expect(result.complete).toBe(false);
    expect(codes(result)).toEqual([extra.bindings ? 'INVALID_CONNECTION_CONFIGURATION' : 'UNAVAILABLE_SOURCE']);
    expect(result.content).toBe(extra.bindings ? 'LRZ' : 'LZ');
  });

  it('rejects foreign instance handles for either selector kind', () => {
    const first = analyze(block('a', 'A')), second = analyze(block('a', 'B'));
    for (const target of [fileTarget(first), blockTarget(first)]) {
      const result = compose(second, target, limits);
      expect(result).toMatchObject({ content: '', complete: false });
      expect(codes(result)).toEqual(['UNAVAILABLE_INSTANCE']);
    }
  });

  it('selects whole files explicitly and rejects missing or unavailable inventories', () => {
    const analysis = analyze('free');
    expect(codes(compose(analysis, { ...fileTarget(analysis), kind: 'file', sourceId: 'absent' }, limits)))
      .toEqual(['SOURCE_NOT_FOUND']);
    const handle = {};
    const partial = analyzeProject({ localInstance: handle, instances: [{ handle, sources: undefined }] });
    expect(codes(compose(partial, fileTarget(partial), limits))).toEqual(['UNAVAILABLE_SOURCE']);
  });
});

describe('composition budgets and ownership', () => {
  it.each([undefined, null, {}, { maxWork: 1 }, { maxOutputBytes: 1 },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'].flatMap(value => [
      { maxWork: value, maxOutputBytes: 10 }, { maxWork: 10, maxOutputBytes: value }
    ])])('rejects invalid limits before selection or traversal: %j', invalid => {
    const analysis = analyze(block('a', include('missing')));
    const result = compose(analysis, blockTarget(analysis), invalid as CompositionLimits);
    expect(result).toMatchObject({ content: '', complete: false });
    expect(codes(result)).toEqual(['INVALID_COMPOSITION_LIMITS']);
  });

  it('permits zero budgets and exact-limit completion without an implicit file root', () => {
    expect(render('', undefined, { maxWork: 0, maxOutputBytes: 0 })).toEqual({ content: '', complete: true, diagnostics: [] });
    expect(render('A', undefined, { maxWork: 0, maxOutputBytes: 1 }).complete).toBe(true);
    expect(render(block('a'), 'a', { maxWork: 1, maxOutputBytes: 0 }).complete).toBe(true);
    expect(codes(render(block('a'), 'a', { maxWork: 0, maxOutputBytes: 0 }))).toEqual(['COMPOSITION_WORK_LIMIT']);
  });

  it('charges every inclusion and target entry, even when bodies are empty', () => {
    const input = block('a', include('b') + include('b')) + block('b');
    expect(render(input, 'a', { maxWork: 5, maxOutputBytes: 0 }).complete).toBe(true);
    expect(codes(render(input, 'a', { maxWork: 4, maxOutputBytes: 0 }))).toEqual(['COMPOSITION_WORK_LIMIT']);
  });

  it('charges failed inclusions and cycle re-entry attempts before acting', () => {
    expect(codes(render(block('a', include('missing')), 'a', { maxWork: 2, maxOutputBytes: 0 })))
      .toEqual(['BLOCK_NOT_FOUND']);
    expect(codes(render(block('a', include('a')), 'a', { maxWork: 2, maxOutputBytes: 0 })))
      .toEqual(['COMPOSITION_WORK_LIMIT']);
    expect(codes(render(block('a', include('a')), 'a', { maxWork: 3, maxOutputBytes: 0 })))
      .toEqual(['BLOCK_CYCLE']);
  });

  it('stops in authored order instead of skipping to later work or diagnostics', () => {
    const input = block('a', 'A' + include('b') + 'Z' + include('missing')) + block('b', 'BC');
    const result = render(input, 'a', { maxWork: 3, maxOutputBytes: 2 });
    expect(result).toMatchObject({ content: 'AB', complete: false });
    expect(codes(result)).toEqual(['COMPOSITION_OUTPUT_LIMIT']);
    expect(render(input, 'a', { maxWork: 2, maxOutputBytes: 100 }).content).toBe('A');
  });

  it.each([[0, ''], [3, 'Hi '], [5, 'Hi '], [7, 'Hi 🌱'], [8, 'Hi 🌱!']])(
    'retains the longest whole-code-point UTF-8 prefix at %i bytes', (maxOutputBytes, expected) => {
      const result = render('Hi 🌱!', undefined, { maxWork: 0, maxOutputBytes });
      expect(result.content).toBe(expected);
      expect(result.complete).toBe(maxOutputBytes === 8);
    });

  it('charges emitted bytes once, including whitespace and each repeated occurrence', () => {
    const input = block('a', include('b') + include('b')) + block('b', ' é\t');
    expect(render(input, 'a', { maxWork: 5, maxOutputBytes: 8 }).complete).toBe(true);
    expect(render(input, 'a', { maxWork: 5, maxOutputBytes: 7 }).content).toBe(' é\t é');
  });

  it('counts surrogate pairs across fragments and preserves unpaired source code units', () => {
    const input = block('a', '\ud83c' + include('b') + '!') + block('b', '\udf31');
    expect(render(input, 'a', { maxWork: 3, maxOutputBytes: 4 }).content).toBe('🌱');
    expect(render(input, 'a', { maxWork: 3, maxOutputBytes: 3 }).content).toBe('');
    expect(render('\ud83c', undefined, { maxWork: 0, maxOutputBytes: 3 })).toMatchObject({ content: '\ud83c', complete: true });
    expect(render('\udf31A', undefined, { maxWork: 0, maxOutputBytes: 3 }).content).toBe('\udf31');
    expect(render('\ud83cA', undefined, { maxWork: 0, maxOutputBytes: 4 }).complete).toBe(true);
  });

  it('keeps prior diagnostics when a later budget is exhausted', () => {
    const result = render(include('missing') + 'XYZ', undefined, { maxWork: 1, maxOutputBytes: 2 });
    expect(result).toMatchObject({ content: 'XY', complete: false });
    expect(codes(result)).toEqual(['BLOCK_NOT_FOUND', 'COMPOSITION_OUTPUT_LIMIT']);
  });

  it('checks oversized recovered headers and trailing surrogates before later actions', () => {
    const result = render('@stem:block(id:a tags:[' + 'x'.repeat(10_000) + '\nBody', undefined,
      { maxWork: 1, maxOutputBytes: 5 });
    expect(result.content).toBe('@stem');
    expect(codes(result)).toContain('COMPOSITION_OUTPUT_LIMIT');
    const surrogate = render('\ud83c' + include('missing'), undefined, { maxWork: 1, maxOutputBytes: 2 });
    expect(surrogate.content).toBe('');
    expect(codes(surrogate)).toEqual(['COMPOSITION_OUTPUT_LIMIT']);
  });

  it('matches UTF-8 prefix accounting across mixed text and expansion boundaries', () => {
    const fragments = ['A', 'é', '\ud83c', '\udf31', '\t', '\ud83c', 'B', '\udf31', '中', '\n'];
    const analysis = analyze(block('root', fragments.map((_, index) => include(`b${index}`)).join(''))
      + fragments.map((fragment, index) => block(`b${index}`, 'x' + fragment + 'y')).join(''));
    const target = blockTarget(analysis, 'root');
    const full = compose(analysis, target, limits).content;
    for (let allowance = 0; allowance <= Buffer.byteLength(full); allowance++) {
      let expected = '';
      for (const point of full) {
        if (Buffer.byteLength(expected + point) > allowance) break;
        expected += point;
      }
      const result = compose(analysis, target, { ...limits, maxOutputBytes: allowance });
      expect(result.content).toBe(expected);
      expect(result.complete).toBe(allowance === Buffer.byteLength(full));
    }
  });

  it('isolates invocations, freezes output and does not freeze or mutate caller selectors/limits', () => {
    const analysis = analyze(block('a', 'A', ' tags:[,]'));
    const target = { kind: 'block' as const, instance: analysis.localInstance!, reference: { id: 'a' } };
    const budget = { ...limits };
    const first = compose(analysis, target, budget);
    expect(compose(analysis, target, { maxWork: 0, maxOutputBytes: 0 }).complete).toBe(false);
    expect(compose(analysis, target, budget)).toEqual(first);
    target.reference.id = 'missing';
    budget.maxWork = 0;
    expect(first.content).toBe('A');
    expect(Object.isFrozen(target.reference)).toBe(false);
    expect(Object.isFrozen(budget)).toBe(false);
    expect(Object.isFrozen(first.diagnostics[0]!.location!.range)).toBe(true);
    expect(() => Object.assign(first, { content: 'changed' })).toThrow();
  });
});

// Reproducible measurements are opt-in, never timing-based acceptance assertions.
// STEM_COMPOSITION_MEASURE=1 reports five warmed composition-only samples per case.
function measure(name: string, analysis: ProjectAnalysis, target: CompositionTarget, budget: CompositionLimits) {
  const result = compose(analysis, target, budget);
  if (process.env['STEM_COMPOSITION_MEASURE'] === '1') {
    const samples: number[] = [];
    for (let sample = 0; sample < 5; sample++) {
      const start = performance.now();
      compose(analysis, target, budget);
      samples.push(performance.now() - start);
    }
    console.log(JSON.stringify({ case: name, limits: budget, bytes: Buffer.byteLength(result.content),
      complete: result.complete, medianMs: samples.sort((a, b) => a - b)[2] }));
  }
  return result;
}

describe('composition representative scale', () => {
  it('handles 12,000 nested definitions without recursion, with exact work accounting', () => {
    const depth = 12_000;
    const analysis = analyze(Array.from({ length: depth }, (_, index) => `@stem:block(id:b${index})`).join('')
      + 'X' + '@stem:end()'.repeat(depth));
    const result = measure('deep containment', analysis, blockTarget(analysis, 'b0'), { maxWork: depth, maxOutputBytes: 1 });
    expect(result).toEqual({ content: 'X', complete: true, diagnostics: [] });
    expect(codes(compose(analysis, blockTarget(analysis, 'b0'), { maxWork: depth - 1, maxOutputBytes: 1 })))
      .toEqual(['COMPOSITION_WORK_LIMIT']);
  });

  it('handles 12,000 nested inclusions and stops their closing cycle', () => {
    const depth = 12_000;
    const analysis = analyze(Array.from({ length: depth }, (_, index) =>
      block(`b${index}`, index === depth - 1 ? 'X' + include('b0') : include(`b${index + 1}`))).join(''));
    const result = measure('deep inclusion cycle', analysis, blockTarget(analysis, 'b0'), { maxWork: 2 * depth + 1, maxOutputBytes: 1 });
    expect(result).toMatchObject({ content: 'X', complete: false });
    expect(codes(result)).toEqual(['BLOCK_CYCLE']);
  });

  it('bounds exponential empty expansion by logical work', () => {
    const analysis = analyze(Array.from({ length: 35 }, (_, index) => block(`b${index}`,
      index === 34 ? '' : include(`b${index + 1}`) + include(`b${index + 1}`))).join(''));
    const result = measure('empty branching', analysis, blockTarget(analysis, 'b0'), { maxWork: 100_000, maxOutputBytes: 0 });
    expect(result).toMatchObject({ content: '', complete: false });
    expect(codes(result)).toEqual(['COMPOSITION_WORK_LIMIT']);
  });

  it('bounds repeated large output before allocating all expanded occurrences', () => {
    const analysis = analyze(block('a', include('b').repeat(1024)) + block('b', 'x'.repeat(16_384)));
    const result = measure('16 MiB repeated output', analysis, blockTarget(analysis), { maxWork: 2049, maxOutputBytes: 16 * 1024 * 1024 });
    expect(result.complete).toBe(true);
    expect(result.content.length).toBe(16 * 1024 * 1024);
    const bounded = measure('1 MiB output stop', analysis, blockTarget(analysis), { maxWork: 2049, maxOutputBytes: 1024 * 1024 });
    expect(bounded.content.length).toBe(1024 * 1024);
    expect(codes(bounded)).toEqual(['COMPOSITION_OUTPUT_LIMIT']);
  });
});
