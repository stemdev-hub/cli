import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../../src/project/analysis.js';
import { findBlocksByTag, resolveBlockReference } from '../../src/project/selection.js';
import type { InstanceInput } from '../../src/project/model.js';

const block = (id: string, tags = '', body = '') => `@stem:block(id:${id} ${tags})${body}@stem:end()`;
const analyze = (content: string) => {
  const handle = {};
  return analyzeProject({ localInstance: handle, instances: [{ handle, sources: [{ sourceId: 'doc', content }] }] });
};

describe('ID resolution', () => {
  it('retains every duplicate candidate even if only one definition is otherwise valid', () => {
    const result = analyze(block('a') + block('a', 'tags:[,]') + block('b', 'tags:[,]'));
    const ambiguous = resolveBlockReference(result, result.localInstance, { id: 'a' });
    expect(ambiguous.status).toBe('ambiguous');
    if (ambiguous.status !== 'ambiguous') throw new Error('Expected ambiguity');
    expect(ambiguous.candidates).toEqual(result.graph.nodes.slice(0, 2));
    expect(ambiguous).not.toHaveProperty('target');
    expect(ambiguous.diagnostics[0]!.related).toHaveLength(2);
    expect(Object.isFrozen(ambiguous.candidates)).toBe(true);
    const selected = resolveBlockReference(result, result.localInstance, { id: 'b' });
    expect(selected.status).toBe('resolved');
    expect(selected.diagnostics.every(diagnostic => diagnostic.code === 'INVALID_TAG_LIST')).toBe(true);
  });

  it('does not choose a missing, malformed or repeated ID', () => {
    const result = analyze('@stem:block(id:a id:b)@stem:end()@stem:block(id:a.b)@stem:end()@stem:block()@stem:end()');
    expect(result.graph.nodes).toHaveLength(3);
    for (const id of ['a', 'b']) expect(resolveBlockReference(result, result.localInstance, { id }).status).toBe('not-found');
    expect(resolveBlockReference(result, result.localInstance, { id: 'a.b' })).toMatchObject({ status: 'unavailable',
      diagnostics: [{ code: 'INVALID_BLOCK_REFERENCE' }] });
  });

  it('selects child diagnostic scope independently while a parent includes descendant errors', () => {
    const result = analyze(block('parent', 'tags:[,]', block('child')) + block('other', '', '@stem:include(missing)'));
    expect(resolveBlockReference(result, result.localInstance, { id: 'child' }).diagnostics).toEqual([]);
    expect(resolveBlockReference(result, result.localInstance, { id: 'parent' }).diagnostics.length).toBeGreaterThan(0);
    expect(resolveBlockReference(result, result.localInstance, { id: 'child' }).diagnostics).not.toContainEqual(
      expect.objectContaining({ code: 'BLOCK_NOT_FOUND' }));
    const nested = analyze(block('p', '', block('c', 'tags:[,]')));
    expect(resolveBlockReference(nested, nested.localInstance, { id: 'p' }).diagnostics.length).toBeGreaterThan(0);
  });

  it('uses the originating instance alias context and keeps same-ID revisions distinct', () => {
    const local = {}, old = {}, current = {}, dependency = {};
    const instances: InstanceInput[] = [
      { handle: local, sources: [{ sourceId: 'doc', content: block('a', '', '@stem:include(old:a)@stem:include(new:a)') }],
        bindings: [{ alias: 'old', target: old }, { alias: 'new', target: current }, { alias: 'dep', target: current }] },
      { handle: old, sources: [{ sourceId: 'doc', content: block('a', '', '@stem:include(dep:a)') }], bindings: [{ alias: 'dep', target: dependency }] },
      { handle: current, sources: [{ sourceId: 'doc', content: block('a') }] },
      { handle: dependency, sources: [{ sourceId: 'doc', content: block('a') }] }
    ];
    const result = analyzeProject({ localInstance: local, instances });
    expect(result.diagnostics).toEqual([]);
    const references = result.graph.edges.filter(edge => edge.kind === 'inclusion');
    expect(references.map(edge => edge.occurrence.resolution.status)).toEqual(['resolved', 'resolved', 'resolved']);
    const nested = references[2]!.occurrence.resolution;
    if (nested.status !== 'resolved') throw new Error('Expected target');
    expect(nested.target.instance).toBe(result.instances[3]);
    const oldTarget = resolveBlockReference(result, result.localInstance, { qualifier: 'old', id: 'a' });
    const newTarget = resolveBlockReference(result, result.localInstance, { qualifier: 'new', id: 'a' });
    if (oldTarget.status !== 'resolved' || newTarget.status !== 'resolved') throw new Error('Expected targets');
    expect(oldTarget.target).not.toBe(newTarget.target);
  });

  it.each(['missing', 'duplicate', 'invalid', 'absent-context', 'unavailable-content', 'invalid-config'] as const)(
    'reports %s binding problems as unavailable, never as an absent Block', problem => {
      const local = {}, remote = {};
      const bindings: NonNullable<InstanceInput['bindings']> = problem === 'missing' ? []
        : problem === 'duplicate' ? [{ alias: 'lib', target: remote }, { alias: 'lib', target: remote }]
        : problem === 'invalid' ? [{ alias: 'LIB', target: remote }]
        : problem === 'invalid-config' ? [{ alias: 'lib', unavailable: 'invalid-configuration' }]
        : [{ alias: 'lib', target: remote }];
      const instances: InstanceInput[] = [{ handle: local, sources: [], bindings }];
      if (problem !== 'absent-context') instances.push({ handle: remote,
        sources: problem === 'unavailable-content' ? undefined : [{ sourceId: 'doc', content: block('a') }] });
      const result = analyzeProject({ localInstance: local, instances });
      const selected = resolveBlockReference(result, result.localInstance, { qualifier: problem === 'invalid' ? 'LIB' : 'lib', id: 'a' });
      expect(selected.status).toBe('unavailable');
      expect(selected.diagnostics.length).toBeGreaterThan(0);
      expect(selected).not.toHaveProperty('target');
      expect(selected).not.toHaveProperty('candidates');
      expect(selected.diagnostics.some(diagnostic => diagnostic.code === 'BLOCK_NOT_FOUND')).toBe(false);
    }
  );

  it('rejects handles from another analysis and preserves mutable query locations', () => {
    const first = analyze(block('a')), second = analyze(block('a'));
    expect(resolveBlockReference(second, first.localInstance, { id: 'a' }).status).toBe('unavailable');
    const location = { sourceId: 'query', range: { startOffset: 0, endOffset: 1 }, instance: {} };
    const failure = resolveBlockReference(first, first.localInstance, { id: 'missing' }, location);
    location.range.startOffset = 50;
    expect(failure.diagnostics[0]!.location!.range.startOffset).toBe(0);
    expect(Object.isFrozen(location.instance)).toBe(false);
    expect(failure.diagnostics[0]!.location!.instance).toBe(first.localInstance!.handle);
  });

  it('retains cycle diagnostics on their owning definitions without contaminating independent siblings', () => {
    const result = analyze(block('cyclic', '', '@stem:include(cyclic)') + block('independent'));
    expect(resolveBlockReference(result, result.localInstance, { id: 'cyclic' }).diagnostics.map(diagnostic => diagnostic.code))
      .toEqual(['BLOCK_CYCLE']);
    expect(resolveBlockReference(result, result.localInstance, { id: 'independent' }).diagnostics).toEqual([]);
    expect(result.diagnostics.filter(diagnostic => diagnostic.code === 'BLOCK_CYCLE')).toHaveLength(1);
  });
});

describe('direct Tag selection', () => {
  it('keeps equal Tag names in different instances separate', () => {
    const local = {}, remote = {};
    const result = analyzeProject({ localInstance: local, instances: [
      { handle: local, sources: [{ sourceId: 'doc', content: block('local', 'tags:[guide]') }] },
      { handle: remote, sources: [{ sourceId: 'doc', content: block('remote', 'tags:[guide]') }] }
    ] });
    expect(findBlocksByTag(result, result.instances[0], 'guide').blocks.map(node => node.id)).toEqual(['local']);
    expect(findBlocksByTag(result, result.instances[1], 'guide').blocks.map(node => node.id)).toEqual(['remote']);
  });
  it('uses NFC equality, preserves first spelling, and does not inherit Tags', () => {
    const result = analyze(block('p', 'tags:[é,"é",Guide]', block('c')) + block('s', 'tags:[guide]'));
    expect(result.graph.nodes[0]!.tags).toEqual(['é', 'Guide']);
    expect(findBlocksByTag(result, result.localInstance, 'é').blocks.map(node => node.id)).toEqual(['p']);
    expect(findBlocksByTag(result, result.localInstance, 'é').blocks.map(node => node.id)).toEqual(['p']);
    expect(findBlocksByTag(result, result.localInstance, 'guide').blocks.map(node => node.id)).toEqual(['s']);
    expect(findBlocksByTag(result, result.localInstance, 'Guide').classificationComplete).toBe(true);
  });

  it('returns tagged duplicates and unaddressable definitions individually', () => {
    const result = analyze(block('a', 'tags:[t]') + block('a', 'tags:[t]') + '@stem:block(tags:[t])@stem:end()');
    const selection = findBlocksByTag(result, result.localInstance, 't');
    expect(selection.blocks.map(node => node.id)).toEqual(['a', 'a', undefined]);
    expect(selection.classificationComplete).toBe(true);
    expect(selection.diagnostics.map(diagnostic => diagnostic.code)).toContain('DUPLICATE_BLOCK_ID');
  });

  it('reports unknown additional matches without dropping known ones', () => {
    const result = analyze(block('known', 'tags:[guide]') + block('partial', 'tags:[api,]'));
    const selection = findBlocksByTag(result, result.localInstance, 'guide');
    expect(selection.blocks.map(node => node.id)).toEqual(['known']);
    expect(selection.classificationComplete).toBe(false);
    expect(selection.diagnostics.map(diagnostic => diagnostic.code)).toContain('INCOMPLETE_TAG_CLASSIFICATION');
    const knownPartial = findBlocksByTag(result, result.localInstance, 'api');
    expect(knownPartial.blocks.map(node => node.id)).toEqual(['partial']);
    expect(knownPartial.classificationComplete).toBe(true);
    expect(knownPartial.diagnostics.map(diagnostic => diagnostic.code)).toContain('INVALID_TAG_LIST');
  });

  it('does not merge repeated fields and treats unfinished metadata as incomplete', () => {
    const result = analyze(block('a', 'tags:[guide] tags:[api]') + '@stem:block(id:b\n@stem:end()');
    expect(result.graph.nodes.map(node => node.classificationComplete)).toEqual([false, false]);
    for (const tag of ['guide', 'api', 'absent']) {
      const selection = findBlocksByTag(result, result.localInstance, tag);
      expect(selection.blocks).toEqual([]);
      expect(selection.classificationComplete).toBe(false);
    }
  });

  it('returns known Tags from partial inventories, but never calls them exhaustive', () => {
    const handle = {};
    const result = analyzeProject({ localInstance: handle, instances: [{ handle, sourcesComplete: false,
      sources: [{ sourceId: 'doc', content: block('a', 'tags:[t]') }] }] });
    const selection = findBlocksByTag(result, result.localInstance, 't');
    expect(selection.blocks.map(node => node.id)).toEqual(['a']);
    expect(selection.classificationComplete).toBe(false);
    expect(findBlocksByTag(result, undefined, 't').classificationComplete).toBe(false);
  });

  it('distinguishes empty exhaustive results from invalid queries', () => {
    const result = analyze(block('a'));
    expect(findBlocksByTag(result, result.localInstance, 'missing')).toEqual({ blocks: [], classificationComplete: true, diagnostics: [] });
    for (const tag of ['', 'a\n', 'a\u0085']) {
      expect(findBlocksByTag(result, result.localInstance, tag)).toMatchObject({ classificationComplete: false,
        diagnostics: [{ code: 'INVALID_TAG_QUERY' }] });
    }
  });
});
