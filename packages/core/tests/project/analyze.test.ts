import { expect, it } from 'vitest';
import {
  analyzeProject,
  compose,
  DEFAULT_COMPOSITION_LIMITS,
  resolveBlockReference
} from '../../src/index.js';
function analyze(content: string) {
  const local = {};
  return analyzeProject({
    localInstance: local,
    instances: [{ handle: local, sources: [{ sourceId: 'doc.md', content }] }]
  });
}

it('keeps duplicate and invalid definitions without inventing identity', () => {
  const analysis = analyze(
    '@stem:block(id:a)One@stem:end()@stem:block(id:a)Two@stem:end()@stem:block(tags:[guide])Anon@stem:end()'
  );
  expect(analysis.graph.nodes.map((n) => n.id)).toEqual(['a', 'a', undefined]);
  expect(resolveBlockReference(analysis, analysis.localInstance, { id: 'a' }).status).toBe(
    'ambiguous'
  );
  expect(Object.isFrozen(analysis.graph.nodes)).toBe(true);
});
it('keeps supplied instance identity distinct and does not use metadata as source', () => {
  const a = {},
    b = {};
  const analysis = analyzeProject({
    localInstance: a,
    instances: [
      {
        handle: a,
        sources: [
          { sourceId: 'same', content: '@stem:block(id:x)A@stem:include(lib:x)@stem:end()' }
        ],
        bindings: [{ alias: 'lib', target: b }]
      },
      { handle: b, sources: [{ sourceId: 'same', content: '@stem:block(id:x)B@stem:end()' }] }
    ]
  });
  expect(
    compose(
      analysis,
      { kind: 'block', instance: analysis.localInstance!, reference: { id: 'x' } },
      DEFAULT_COMPOSITION_LIMITS
    )
  ).toMatchObject({ content: 'AB', complete: true, diagnostics: [] });
});
