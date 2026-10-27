import { describe, expect, it } from 'vitest';
import { normalizeOutputSets } from '../../src/config/outputs.js';
import * as core from '../../src/index.js';

const configPath = '/project/.stem/config.json';
const target = (path = 'README.md') => ({ source: { kind: 'block', ref: 'guide' }, path });
const config = (targets: unknown[] = [target()]) => ({ docs: { targets } });
const normalize = (raw: unknown, blocksDir = 'blocks') => normalizeOutputSets(raw, blocksDir, configPath);
const ok = (raw: unknown, blocksDir = 'blocks') => {
  const result = normalize(raw, blocksDir);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
};
const failure = (raw: unknown, code = 'CONFIG_INVALID_SCHEMA', blocksDir = 'blocks') => {
  const result = normalize(raw, blocksDir);
  expect(result).toMatchObject({ success: false, error: { code, path: configPath } });
  if (result.success) throw new Error('Expected invalid configuration');
  expect(Object.isFrozen(result.error)).toBe(true);
  return result.error;
};

describe('private output configuration', () => {
  it('accepts library-only configurations without inventing targets', () => {
    expect(Object.keys(ok(undefined))).toEqual([]);
    expect(Object.keys(ok({}))).toEqual([]);
    expect(ok(config([]))['docs']).toEqual({ targets: [], outputDir: '.', ifExists: 'replace', cleanup: 'keep' });
    expect(core).not.toHaveProperty('normalizeOutputSets');
  });

  it('preserves target order and explicit selectors, with effective set-wide defaults', () => {
    const input = config([target('z'), { source: { kind: 'file', path: 'blocks/guide.md' }, path: 'a.txt' },
      { source: { kind: 'block', ref: 'lib-two:Guide_2' }, path: 'last' }]);
    expect(ok(input)['docs']).toEqual({ ...input.docs, outputDir: '.', ifExists: 'replace', cleanup: 'keep' });
  });

  it('accepts every supported policy and preserves case-sensitive names and source references', () => {
    const input = { Docs: { targets: [target()], ifExists: 'skip', cleanup: 'prune' },
      docs: { targets: [], ifExists: 'error', cleanup: 'keep' },
      ' documentation ': { targets: [target()], ifExists: 'replace' } };
    const result = ok(input);
    expect(Object.keys(result)).toEqual(['Docs', 'docs', ' documentation ']);
    expect(result['Docs']).toMatchObject({ ifExists: 'skip', cleanup: 'prune' });
    expect(result['docs']).toMatchObject({ ifExists: 'error', cleanup: 'keep' });
    expect(result[' documentation ']).toMatchObject({ ifExists: 'replace', cleanup: 'keep' });
  });

  it('treats prototype-looking set names as data without inherited dictionary entries', () => {
    const input: unknown = JSON.parse('{"__proto__":{"targets":[]},"constructor":{"targets":[]},"toString":{"targets":[]}}');
    const result = ok(input);
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(Object.keys(result)).toEqual(['__proto__', 'constructor', 'toString']);
    expect(result['__proto__']!.targets).toEqual([]);
    expect(ok({})['constructor']).toBeUndefined();
  });

  it('copies and freezes every returned collection/record without freezing its input', () => {
    const input = config();
    const before = structuredClone(input);
    const result = normalize(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(input).toEqual(before);
    expect(Object.isFrozen(input.docs.targets[0])).toBe(false);
    const set = result.data['docs']!;
    expect([result, result.data, set, set.targets, set.targets[0], set.targets[0]!.source].every(Object.isFrozen)).toBe(true);
    Object.assign(input.docs.targets[0]!, { path: 'changed', source: { kind: 'block', ref: 'changed' } });
    input.docs.targets.push(target('extra'));
    expect(set.targets).toEqual(before.docs.targets);
    expect(() => Object.assign(set.targets[0]!.source, { ref: 'changed' })).toThrow();
    expect(normalize(before)).toEqual(result);
  });

  it.each([null, false, 0, 'docs', [], new Date(0)])('rejects a non-map outputSets value: %j', raw => {
    failure(raw);
  });

  it.each([null, [], 'value', false])('requires objects for sets, targets and selectors: %j', raw => {
    failure({ docs: raw });
    failure(config([raw]));
    failure(config([{ ...target(), source: raw }]));
  });

  it('requires a nonempty name and an explicitly supplied target array', () => {
    failure({ '': { targets: [] } });
    for (const targets of [undefined, null, {}, 'all', false]) failure({ docs: { targets } });
    failure({ docs: {} });
    failure(config(new Array<unknown>(1)));
    failure(Object.create({ docs: { targets: [] } }));
    const inherited: unknown = Object.create({ targets: [] });
    failure({ docs: inherited });
  });

  it.each(['target', 'extends', 'OutputDir', 'maxWork', 'constructor', '__proto__'])(
    'rejects unknown set fields with field context: %s', key => {
      const error = failure({ docs: { targets: [], [key]: undefined } });
      expect(error.message).toContain(key);
      expect(error.message).toContain('outputSets');
    });

  it.each(['ifExists', 'cleanup', 'destination', 'sources', '__proto__'])(
    'rejects target-level policies and unknown target fields: %s', key => {
      expect(failure(config([{ ...target(), [key]: true }])).message).toContain(`targets[0].${key}`);
    });

  it('requires exactly the fields belonging to the explicit selector kind', () => {
    for (const source of [
      { ref: 'guide' }, { path: 'blocks/a.md' }, { kind: 'tag', ref: 'guide' },
      { kind: 'block' }, { kind: 'file' }, { kind: 'Block', ref: 'guide' },
      { kind: 'block', ref: 'guide', path: 'blocks/a.md' },
      { kind: 'file', path: 'blocks/a.md', ref: 'guide' },
      { kind: 'file', path: 'blocks/a.md', project: 'other' }
    ]) failure(config([{ source, path: 'README.md' }]));
    failure(config([{ source: { kind: 'block', ref: 'guide' } }]));
  });

  it.each(['', ' guide', 'guide ', 'guide\n', 'guide\r\n', 'guide\u2028', 'guide\u2029', '@stem:include(guide)', 'bad id',
    'UPPER:guide', 'lib--two:guide', 'lib:', ':guide', 'lib:other:guide', 'é', 42, null])(
    'rejects invalid references without repairing them: %j', ref => {
      failure(config([{ source: { kind: 'block', ref }, path: 'README.md' }]));
    });

  it.each([null, '', false, 1, 'REPLACE', 'overwrite'])('rejects invalid policy values: %j', value => {
    failure({ docs: { targets: [], ifExists: value } });
    failure({ docs: { targets: [], cleanup: value } });
  });
});

describe('output configuration path boundaries', () => {
  it('normalizes relative separators and redundant dots, retaining explicit filenames', () => {
    const result = ok(config([{ source: { kind: 'file', path: '.\\docs\\source//./guide.markdown' }, path: './out//./README' }]),
      './docs/source/');
    expect(result['docs']!.targets).toEqual([{ source: { kind: 'file', path: 'docs/source/guide.markdown' }, path: 'out/README' }]);
  });

  it.each(['', '.', './', 'folder/', 'folder\\', 'folder/.', '..', '../a', 'a/../b',
    '/a', '\\a', 'C:\\a', 'C:a', './C:/a', './https://host/a', '\\\\server\\share\\a', 'https://host/a', 'a\0b'])(
    'rejects invalid source and target file paths: %j', path => {
      failure(config([target(path)]), 'CONFIG_INVALID_PATH');
      failure(config([{ source: { kind: 'file', path }, path: 'valid' }]), 'CONFIG_INVALID_PATH');
    });

  it.each([undefined, null, 0, [], {}])('rejects non-string paths: %j', path => {
    failure(config([{ ...target(), path }]));
    failure(config([{ source: { kind: 'file', path }, path: 'valid' }]));
  });

  it.each(['blocks', 'blocks-other/a.md', 'Blocks/a.md', 'other/blocks/a.md', 'a.md'])(
    'requires file selectors beneath the configured directory: %s', path => {
      failure(config([{ source: { kind: 'file', path }, path: 'valid' }]), 'CONFIG_INVALID_PATH');
    });

  it('uses the configured source directory instead of a hard-coded or relative-to-source base', () => {
    expect(ok(config([{ source: { kind: 'file', path: 'docs/sources/a.md' }, path: 'a' }]), 'docs/sources')['docs']!.targets)
      .toHaveLength(1);
    failure(config([{ source: { kind: 'file', path: 'blocks/a.md' }, path: 'a' }]), 'CONFIG_INVALID_PATH', 'docs/sources');
    for (const directory of ['', '.', '../blocks', '/blocks', 'C:blocks', 'blocks\0']) {
      failure({}, 'CONFIG_INVALID_PATH', directory);
    }
  });

  it.each(['.', '..', '../published', 'out/../published', './out/', '/tmp/docs', 'C:\\docs', 'C:/docs', '\\\\server\\share\\docs'])(
    'preserves output-directory spelling for adapter resolution: %s', outputDir => {
      expect(ok({ docs: { targets: [], outputDir } })['docs']!.outputDir).toBe(outputDir);
    });

  it.each(['', 'C:', 'C:docs', 'https://host/docs', 'file:///tmp/docs', 's3:bucket', 'out\0dir'])(
    'rejects intrinsically invalid output directories: %j', outputDir => {
      failure({ docs: { targets: [], outputDir } }, 'CONFIG_INVALID_PATH');
    });

  it.each([null, 0, false, {}])('rejects a non-string output directory: %j', outputDir => {
    failure({ docs: { targets: [], outputDir } });
  });

  it('does not discover files, resolve references or claim destinations are safe to publish', () => {
    const targets = [target('same'), target('same'), target('SAME'), target('same/child')];
    const result = ok({ first: { targets }, second: { targets: [target('same')] },
      missing: { targets: [{ source: { kind: 'file', path: 'blocks/not-present.any' }, path: '.stem/config.json' }] } });
    expect(result['first']!.targets).toHaveLength(4);
    expect(result['second']!.targets[0]!.path).toBe('same');
    expect(result['missing']!.targets[0]!.path).toBe('.stem/config.json');
    // Selection/collision, source availability and protected-path checks belong to adapters.
  });
});
