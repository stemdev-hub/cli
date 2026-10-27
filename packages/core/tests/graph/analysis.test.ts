import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../../src/project/analysis.js';
import { buildGraph, detectCycles, getOrphanedBlocks, validateGraph } from '../../src/graph/analysis.js';
import { resolveBlockReference } from '../../src/project/selection.js';
import type { InstanceInput, OutputScope } from '../../src/project/model.js';

const block = (id: string, body = '') => `@stem:block(id:${id})${body}@stem:end()`;
const include = (id: string) => `@stem:include(${id})`;
const analyze = (content: string, outputs?: OutputScope) => {
  const handle = {};
  return analyzeProject({ localInstance: handle, instances: [{ handle, sources: [{ sourceId: 'doc', content }] }],
    ...(outputs ? { outputs } : {}) });
};
const roots = (...ids: string[]): OutputScope => ({ complete: true,
  targets: ids.map(id => ({ kind: 'block', reference: { id } })) });

describe('containment and inclusion graph', () => {
  it('retains authored edge order, file-level and repeated inclusions, and unresolved occurrences', () => {
    const result = analyze(include('a') + block('a', include('b') + block('child') + include('b') + include('missing')) + block('b'));
    expect(result.graph.nodes.map(node => node.id)).toEqual(['a', 'child', 'b']);
    expect(result.graph.edges.map(edge => edge.kind)).toEqual(['inclusion', 'inclusion', 'containment', 'inclusion', 'inclusion']);
    const references = result.graph.edges.filter(edge => edge.kind === 'inclusion');
    expect(references.map(edge => edge.occurrence.owner?.id)).toEqual([undefined, 'a', 'a', 'a']);
    expect(references.map(edge => edge.occurrence.resolution.status)).toEqual(['resolved', 'resolved', 'resolved', 'not-found']);
    expect(result.graph.edges[2]).toMatchObject({ kind: 'containment', from: { id: 'a' }, to: { id: 'child' } });
    expect(result.graph.nodes.some(node => node.id === 'missing')).toBe(false);
    expect(buildGraph(result).nodes).toEqual(result.graph.nodes);
    expect(Object.isFrozen(result.graph.edges)).toBe(true);
    expect(Object.isFrozen(result.graph.edges[0])).toBe(true);
  });

  it('keeps ambiguous edges with all candidates and no chosen target', () => {
    const result = analyze(include('a') + block('a') + block('a'));
    const edge = result.graph.edges[0]!;
    if (edge.kind !== 'inclusion') throw new Error('Expected inclusion');
    expect(edge.occurrence.resolution).toMatchObject({ status: 'ambiguous', candidates: [{ id: 'a' }, { id: 'a' }] });
    expect(edge.occurrence.resolution).not.toHaveProperty('target');
    expect(result.graph.nodes).toHaveLength(2);
  });

  it('does not invent nodes for ordinary surrounding text or a definition-free file', () => {
    const result = analyze('---\nid: ordinary\n---\n' + include('absent'));
    expect(result.graph.nodes).toEqual([]);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['BLOCK_NOT_FOUND']);
  });
});

describe('cycle checking', () => {
  it.each([
    [block('a', include('a')), ['a', 'a']],
    [block('a', include('b')) + block('b', include('a')), ['a', 'b', 'a']],
    [block('a', block('child', include('a'))), ['a', 'child', 'a']]
  ] as const)('detects cycles through authored containment or inclusion', (content, expected) => {
    const result = analyze(content);
    const cycles = detectCycles(result.graph);
    expect(cycles.map(cycle => cycle.path.map(node => node.id))).toEqual([expected]);
    const diagnostics = validateGraph(result.graph).filter(diagnostic => diagnostic.code === 'BLOCK_CYCLE');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.location!.instance).toBe(result.localInstance!.handle);
    expect(diagnostics[0]!.related).toHaveLength(expected.length - 1);
    expect(Object.isFrozen(cycles[0]!.path)).toBe(true);
  });

  it('allows repeated occurrences and shared descendants after an active path completes', () => {
    const result = analyze(block('root', include('a') + include('b') + include('a'))
      + block('a', include('shared')) + block('b', include('shared')) + block('shared'));
    expect(detectCycles(result.graph)).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('does not duplicate a cycle merely because the closing inclusion is repeated', () => {
    const result = analyze(block('a', include('b') + include('b')) + block('b', include('a') + include('a')));
    expect(detectCycles(result.graph)).toHaveLength(1);
    expect(detectCycles(result.graph)).toEqual(detectCycles(result.graph));
  });

  it('distinguishes equal IDs in different instances and recognizes an actual alias revisit', () => {
    const local = {}, remote = {};
    const make = (returnReference: boolean) => {
      const instances: InstanceInput[] = [
        { handle: local, sources: [{ sourceId: 'doc', content: block('a', include('lib:a')) }], bindings: [{ alias: 'lib', target: remote }] },
        { handle: remote, sources: [{ sourceId: 'doc', content: block('a', returnReference ? include('back:a') : '') }],
          bindings: [{ alias: 'back', target: local }] }
      ];
      return analyzeProject({ localInstance: local, instances });
    };
    expect(detectCycles(make(false).graph)).toEqual([]);
    const cyclic = make(true);
    const path = detectCycles(cyclic.graph)[0]!.path;
    expect(path.map(node => node.id)).toEqual(['a', 'a', 'a']);
    expect(path[0]).toBe(path[2]);
    expect(path[0]!.instance).not.toBe(path[1]!.instance);
  });

  it('handles a deep inclusion cycle without recursive traversal', () => {
    const size = 12_000;
    const result = analyze(Array.from({ length: size }, (_, i) => block(`b${i}`, include(`b${(i + 1) % size}`))).join(''));
    const cycles = detectCycles(result.graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.path).toHaveLength(size + 1);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['BLOCK_CYCLE']);
  }, 15_000);
});

describe('configured-output reachability', () => {
  it('counts descendants and transitive inclusions from every supplied target', () => {
    const result = analyze(block('one', block('child', include('leaf')))
      + block('two') + block('leaf') + block('left-out'), roots('one', 'two'));
    expect(result.outputUsage).toMatchObject({ applicable: true, complete: true });
    expect(result.outputUsage.blocks.map(node => node.id)).toEqual(['left-out']);
    expect(result.outputUsage.diagnostics).toMatchObject([{ code: 'ORPHANED_BLOCK', severity: 'warning',
      message: 'Block is not reachable from any configured output; it may have been left out.' }]);
    expect(result.outputUsage.diagnostics[0]!.location!.instance).toBe(result.localInstance!.handle);
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
  });

  it('treats a whole-file root as all definitions plus file-level inclusions', () => {
    const handle = {};
    const result = analyzeProject({ localInstance: handle, instances: [{ handle, sources: [
      { sourceId: 'file', content: include('remote-file-block') + block('parent', block('child')) },
      { sourceId: 'other', content: block('remote-file-block') + block('unused') }
    ] }], outputs: { complete: true, targets: [{ kind: 'file', sourceId: 'file' }] } });
    expect(result.outputUsage.blocks.map(node => node.id)).toEqual(['unused']);
    expect(result.outputUsage.complete).toBe(true);
  });

  it('supports definition-free file roots and preserves duplicate and invalid candidates', () => {
    const handle = {};
    const result = analyzeProject({ localInstance: handle, instances: [{ handle, sources: [
      { sourceId: 'file', content: 'plain text' },
      { sourceId: 'other', content: block('a') + block('a') + '@stem:block()@stem:end()' }
    ] }], outputs: { complete: true, targets: [{ kind: 'file', sourceId: 'file' }] } });
    expect(result.outputUsage.blocks.map(node => node.id)).toEqual(['a', 'a', undefined]);
    expect(result.outputUsage.diagnostics).toHaveLength(3);
    expect(new Set(result.outputUsage.blocks).size).toBe(3);
  });

  it('reaches invalid/duplicate definitions through whole-file ownership without selecting IDs', () => {
    const result = analyze(block('a') + block('a') + '@stem:block()@stem:end()',
      { complete: true, targets: [{ kind: 'file', sourceId: 'doc' }] });
    expect(result.outputUsage).toMatchObject({ complete: true, blocks: [], diagnostics: [] });
    expect(result.diagnostics.some(diagnostic => diagnostic.severity === 'error')).toBe(true);
  });

  it('does not mark an unreachable cycle as used; a reachable cycle terminates traversal', () => {
    const content = block('root') + block('a', include('b')) + block('b', include('a'));
    const outside = analyze(content, roots('root'));
    expect(outside.outputUsage.blocks.map(node => node.id)).toEqual(['a', 'b']);
    expect(outside.outputUsage.complete).toBe(true);
    const reached = analyze(content, roots('root', 'a'));
    expect(reached.outputUsage).toMatchObject({ complete: true, blocks: [] });
    expect(reached.diagnostics.some(diagnostic => diagnostic.code === 'BLOCK_CYCLE')).toBe(true);
  });

  it('does not infer warnings without an output scope or configured targets', () => {
    for (const outputs of [undefined, roots()]) {
      const result = analyze(block('a'), outputs);
      expect(result.outputUsage).toMatchObject({ applicable: false, blocks: [], diagnostics: [] });
      expect(result.diagnostics).toEqual([]);
    }
  });

  it.each([
    ['missing target', block('a'), roots('missing')],
    ['ambiguous target', block('a') + block('a'), roots('a')],
    ['missing file', block('a'), { complete: true, targets: [{ kind: 'file', sourceId: 'missing' }] }],
    ['incomplete roots', block('a'), { complete: false, targets: [] }],
    ['unresolved inclusion', block('a', include('missing')) + block('left'), roots('a')],
    ['unknown alias', block('a', include('other:x')) + block('left'), roots('a')],
    ['ambiguous inclusion', block('root', include('a')) + block('a') + block('a'), roots('root')],
    ['malformed inclusion', block('a', '@stem:include(#bad)') + block('left'), roots('a')],
    ['unfinished header', '@stem:block(id:a\n@stem:end()' + block('left'), roots('a')],
    ['file-level recovery', '@stem:include(#bad)' + block('left'), { complete: true, targets: [{ kind: 'file', sourceId: 'doc' }] }]
  ] satisfies [string, string, OutputScope][])('suppresses per-Block warnings for %s', (_name, content, outputs) => {
    const result = analyze(content, outputs);
    expect(result.outputUsage).toMatchObject({ applicable: true, complete: false, blocks: [] });
    expect(result.outputUsage.diagnostics.length).toBeGreaterThan(0);
    expect(result.outputUsage.diagnostics.every(diagnostic => diagnostic.severity === 'warning')).toBe(true);
    expect(result.diagnostics.some(diagnostic => diagnostic.code === 'ORPHANED_BLOCK')).toBe(false);
  });

  it('does not let an unresolved inclusion in an unreachable Block invalidate known reachability', () => {
    const result = analyze(block('root') + block('outside', include('missing')), roots('root'));
    expect(result.outputUsage).toMatchObject({ complete: true });
    expect(result.outputUsage.blocks.map(node => node.id)).toEqual(['outside']);
    expect(result.diagnostics.some(diagnostic => diagnostic.code === 'BLOCK_NOT_FOUND')).toBe(true);
  });

  it('does not conflate unrelated recovery or Tag errors with reachability of a selected child', () => {
    const content = '@stem:include(#bad)@stem:block(id:parent tags:[,])@stem:include(#bad)'
      + block('child') + '@stem:end()' + block('unused');
    const result = analyze(content, roots('child'));
    expect(result.outputUsage).toMatchObject({ complete: true });
    expect(result.outputUsage.blocks.map(node => node.id)).toEqual(['parent', 'unused']);
    expect(resolveBlockReference(result, result.localInstance, { id: 'child' }).diagnostics).toEqual([]);
  });

  it('traverses connected content and back-references without warning about external library Blocks', () => {
    const local = {}, remote = {};
    const result = analyzeProject({ localInstance: local, instances: [
      { handle: local, sources: [{ sourceId: 'doc', content: block('back') + block('left') }], bindings: [{ alias: 'lib', target: remote }] },
      { handle: remote, sources: [{ sourceId: 'doc', content: block('root', include('local:back')) + block('unused-library') }],
        bindings: [{ alias: 'local', target: local }] }
    ], outputs: { complete: true, targets: [{ kind: 'block', reference: { qualifier: 'lib', id: 'root' } }] } });
    expect(result.outputUsage.blocks.map(node => node.id)).toEqual(['left']);
    expect(result.outputUsage.complete).toBe(true);
    expect(result.outputUsage.diagnostics.every(diagnostic => diagnostic.location!.instance === result.localInstance!.handle)).toBe(true);
  });

  it('does not accept a local instance from another analysis', () => {
    const first = analyze(block('a')), second = analyze(block('a'));
    expect(getOrphanedBlocks(second.graph, first.localInstance, roots('a'))).toMatchObject({ complete: false, blocks: [] });
  });

  it('does not attach output-usage warnings to a selected Block or change its validity', () => {
    const result = analyze(block('root') + block('library'), roots('root'));
    const selection = resolveBlockReference(result, result.localInstance, { id: 'library' });
    expect(selection.status).toBe('resolved');
    expect(selection.diagnostics).toEqual([]);
    expect(result.outputUsage.diagnostics[0]!.code).toBe('ORPHANED_BLOCK');
    expect(result.graph.nodes[1]!.diagnostics).toEqual([]);
  });

  it('handles deep containment reachability without expanding content', () => {
    const depth = 12_000;
    const result = analyze(Array.from({ length: depth }, (_, i) => `@stem:block(id:b${i})`).join('')
      + '@stem:end()'.repeat(depth) + block('unused'), roots('b0'));
    expect(result.outputUsage).toMatchObject({ complete: true });
    expect(result.outputUsage.blocks.map(node => node.id)).toEqual(['unused']);
  }, 15_000);
});
