import { expect, it } from 'vitest';
import { analyzeProject } from '../../src/index.js';
function analyze(content: string) {
  const local = {};
  return analyzeProject({
    localInstance: local,
    instances: [{ handle: local, sources: [{ sourceId: 'doc.md', content }] }]
  });
}

it('builds containment and authored inclusion edges including surrounding scope', () => {
  const analysis = analyze(
    '@stem:include(child)@stem:block(id:root)@stem:block(id:child)X@stem:end()@stem:include(child)@stem:end()'
  );
  expect(analysis.graph.nodes).toHaveLength(2);
  expect(analysis.graph.edges.filter((e) => e.kind === 'containment')).toHaveLength(1);
  expect(analysis.graph.edges.filter((e) => e.kind === 'inclusion')).toHaveLength(2);
});
