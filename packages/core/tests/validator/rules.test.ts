import { expect, it } from 'vitest';
import { analyzeProject, validateExternalReferences } from '../../src/index.js';
import type { ExternalSnapshotState } from '../../src/index.js';
function analyze(content: string) {
  const local = {};
  return analyzeProject({
    localInstance: local,
    instances: [{ handle: local, sources: [{ sourceId: 'doc.md', content }] }]
  });
}

const graph = {
  version: '2' as const,
  projectId: '0f671f2d-657d-4f3c-9a7d-d22f769c083a',
  namespace: 'lib',
  publishedAt: 'permissive',
  contentSha: '',
  blocks: [{ id: 'x', tags: [] }],
  renames: []
};
it('valid metadata cannot make an unavailable authored inclusion complete', () => {
  const analysis = analyze('@stem:include(lib:x)');
  expect(
    validateExternalReferences(
      analysis,
      { lib: { graphUrl: 'unused' } },
      new Map([['lib', { graph, fetchedAt: 'not a date', isLocalFallback: false }]]),
      { nowMs: 0 }
    )
  ).toEqual([]);
  expect(analysis.localInstance!.sources[0]!.inclusions[0]!.resolution.status).not.toBe('resolved');
});
it.each([false, true])('retains explicit time/strict warning behavior: %s', (strictExternal) => {
  const snapshots = new Map<string, ExternalSnapshotState>([
    ['lib', { graph, fetchedAt: '1970-01-01', isLocalFallback: false }]
  ]);
  expect(
    validateExternalReferences(
      analyze('@stem:include(lib:x)'),
      { lib: { graphUrl: 'unused' } },
      snapshots,
      { nowMs: 8 * 86400000, strictExternal }
    )
  ).toEqual([
    expect.objectContaining({
      code: 'EXPIRED_SNAPSHOT',
      severity: strictExternal ? 'error' : 'warning'
    })
  ]);
});
