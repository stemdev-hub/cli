import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../../src/project/analysis.js';
import { resolveBlockReference } from '../../src/project/selection.js';
import type { InstanceInput } from '../../src/project/model.js';

const source = (content: string, sourceId = 'doc') => ({ sourceId, content });
const block = (id: string, body = '') => `@stem:block(id:${id})${body}@stem:end()`;
const analyze = (content: string) => {
  const handle = {};
  return analyzeProject({ localInstance: handle, instances: [{ handle, sources: [source(content)] }] });
};

describe('replacement analysis', () => {
  it('retains nested, duplicate, invalid and missing IDs as separate definitions', () => {
    const result = analyze(block('a', block('child')) + block('a')
      + '@stem:block(id:a id:b)@stem:end()@stem:block(tags:[guide])@stem:end()');
    expect(result.graph.nodes.map(node => node.id)).toEqual(['a', 'child', 'a', undefined, undefined]);
    expect(new Set(result.graph.nodes).size).toBe(5);
    expect(result.graph.nodes[1]!.parent).toBe(result.graph.nodes[0]);
    expect(result.diagnostics.filter(diagnostic => diagnostic.code === 'DUPLICATE_BLOCK_ID')).toHaveLength(1);
    const duplicate = result.diagnostics.find(diagnostic => diagnostic.code === 'DUPLICATE_BLOCK_ID')!;
    expect(result.graph.nodes[0]!.diagnostics).toContain(duplicate);
    expect(result.graph.nodes[2]!.diagnostics).toContain(duplicate);
    expect(duplicate.related).toHaveLength(1);
    expect(result.outputUsage).toMatchObject({ applicable: false, blocks: [] });
  });

  it('shares equal syntax without sharing instance interpretations or diagnostic locations', () => {
    const first = {}, second = {};
    const shared = source('@stem:block(id:a tags:[,])@stem:end()');
    const result = analyzeProject({ localInstance: first, instances: [first, second].map(handle => ({ handle, sources: [shared] })) });
    const [left, right] = result.graph.nodes;
    expect(left!.syntax).toBe(right!.syntax);
    expect(left).not.toBe(right);
    expect(left!.instance).not.toBe(right!.instance);
    expect(left!.diagnostics[0]!.location!.instance).toBe(left!.instance.handle);
    expect(right!.diagnostics[0]!.location!.instance).toBe(right!.instance.handle);
    expect(left!.syntax.diagnostics[0]!.location).not.toHaveProperty('instance');
    expect(result.diagnostics.filter(diagnostic => diagnostic.code === 'DUPLICATE_BLOCK_ID')).toEqual([]);
  });

  it('uses fresh handles on later analyses and retains no mutable source or binding aliases', () => {
    const handle = {}, remote = {};
    const document = source(block('a'));
    const bindings = [{ alias: 'lib', target: remote }];
    const instances = [{ handle, sources: [document], bindings }, { handle: remote, sources: [source(block('b'))], bindings: [] }];
    const snapshot = { localInstance: handle, instances };
    const result = analyzeProject(snapshot);
    const next = analyzeProject(snapshot);
    expect(result.localInstance!.handle).not.toBe(handle);
    expect(next.localInstance!.handle).not.toBe(result.localInstance!.handle);
    expect(next.graph.nodes[0]).not.toBe(result.graph.nodes[0]);
    document.content = 'changed';
    bindings[0]!.alias = 'changed';
    instances.pop();
    expect(result.graph.nodes[0]!.source.tree.source.content).toBe(block('a'));
    expect(resolveBlockReference(result, result.localInstance, { qualifier: 'lib', id: 'b' }).status).toBe('resolved');
    expect(Object.isFrozen(handle)).toBe(false);
    expect(Object.isFrozen(bindings)).toBe(false);
    expect(Object.isFrozen(result.graph.nodes[0]!.children)).toBe(true);
    expect(Object.isFrozen(result.localInstance!.bindings[0])).toBe(true);
    expect(() => Object.assign(result.localInstance!, { available: false })).toThrow();
  });

  it('associates body errors and reference failures directly, without inheriting parent metadata errors', () => {
    const result = analyze('@stem:block(id:p tags:[,])@stem:unknown()'
      + block('c', '@stem:include(missing)') + '@stem:end()' + '@stem:include(outside)');
    const [parent, child] = result.graph.nodes;
    expect(parent!.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['INVALID_TAG_LIST', 'INVALID_TAG_LIST', 'INVALID_STEM_INSTRUCTION']);
    expect(child!.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['BLOCK_NOT_FOUND']);
    expect(result.localInstance!.sources[0]!.inclusions.map(occurrence => occurrence.owner?.id)).toEqual(['c', undefined]);
    expect(result.localInstance!.sources[0]!.diagnostics.filter(diagnostic => diagnostic.code === 'BLOCK_NOT_FOUND')).toHaveLength(2);
  });

  it('distinguishes empty sources from unavailable or partial source inventories', () => {
    const handles = [{}, {}, {}];
    const instances: InstanceInput[] = [
      { handle: handles[0]!, sources: [] }, { handle: handles[1]!, sources: undefined },
      { handle: handles[2]!, sources: [source(block('a'))], sourcesComplete: false }
    ];
    const result = analyzeProject({ localInstance: handles[0]!, instances });
    expect(result.instances.map(instance => instance.available)).toEqual([true, false, false]);
    expect(result.instances.map(instance => resolveBlockReference(result, instance, { id: 'a' }).status))
      .toEqual(['not-found', 'unavailable', 'unavailable']);
    expect(result.graph.nodes.map(node => node.id)).toEqual(['a']);
  });

  it('retains duplicate source inventories but refuses ambiguous lookup and file selection', () => {
    const handle = {};
    const result = analyzeProject({ localInstance: handle,
      instances: [{ handle, sources: [source(block('a')), source(block('b'))] }],
      outputs: { complete: true, targets: [{ kind: 'file', sourceId: 'doc' }] } });
    expect(result.graph.nodes.map(node => node.id)).toEqual(['a', 'b']);
    expect(result.diagnostics.some(diagnostic => diagnostic.code === 'DUPLICATE_SOURCE_ID')).toBe(true);
    expect(resolveBlockReference(result, result.localInstance, { id: 'a' }).status).toBe('unavailable');
    expect(result.outputUsage).toMatchObject({ complete: false, blocks: [] });
  });

  it('does not choose between repeated supplied instance tokens', () => {
    const local = {}, repeated = {};
    const result = analyzeProject({ localInstance: repeated, instances: [
      { handle: local, sources: [], bindings: [{ alias: 'lib', target: repeated }] },
      { handle: repeated, sources: [source(block('a'))] },
      { handle: repeated, sources: [source(block('b'))] }
    ] });
    expect(result.localInstance).toBeUndefined();
    expect(result.graph.nodes).toHaveLength(2);
    expect(resolveBlockReference(result, result.instances[0], { qualifier: 'lib', id: 'a' }).status).toBe('unavailable');
    expect(result.instances.slice(1).every(instance => !instance.available)).toBe(true);
  });

  it('handles an empty supplied context with a diagnostic instead of invented identity', () => {
    const result = analyzeProject({ localInstance: {}, instances: [] });
    expect(result.graph.nodes).toEqual([]);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['UNAVAILABLE_LOCAL_INSTANCE']);
    expect(result).not.toHaveProperty('localInstance');
  });

  it('keeps deep definition inventories and diagnostic collection stack-safe', () => {
    const depth = 12_000;
    const result = analyze(Array.from({ length: depth }, (_, i) => `@stem:block(id:b${i})`).join('')
      + '@stem:include(missing)' + '@stem:end()'.repeat(depth));
    expect(result.graph.nodes).toHaveLength(depth);
    const selection = resolveBlockReference(result, result.localInstance, { id: 'b0' });
    expect(selection.status).toBe('resolved');
    expect(selection.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['BLOCK_NOT_FOUND']);
    expect(result.graph.nodes[0]!.diagnostics).toEqual([]);
  }, 15_000);
});
