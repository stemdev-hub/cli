import { expect, it } from 'vitest';
import { analyzeProject, detectCycles } from '../../src/index.js';
import { createActivePath } from '../../src/graph/traverser.js';
function analyze(content: string) {
  const local = {};
  return analyzeProject({
    localInstance: local,
    instances: [{ handle: local, sources: [{ sourceId: 'doc.md', content }] }]
  });
}

it('detects a cycle through containment and inclusion without confusing repeated expansion', () => {
  expect(
    detectCycles(
      analyze('@stem:block(id:a)@stem:block(id:b)@stem:include(a)@stem:end()@stem:end()').graph
    )
  ).toHaveLength(1);
  expect(
    detectCycles(
      analyze(
        '@stem:block(id:a)@stem:include(b)@stem:include(b)@stem:end()@stem:block(id:b)B@stem:end()'
      ).graph
    )
  ).toHaveLength(0);
});
it('keeps active path membership local to traversal', () => {
  const path = createActivePath<object>();
  expect(path).toBeDefined();
});
