import { expect, it } from 'vitest';
import { analyzeProject, compose, DEFAULT_COMPOSITION_LIMITS } from '../../src/index.js';
function analyze(content: string) {
  const local = {};
  return analyzeProject({
    localInstance: local,
    instances: [{ handle: local, sources: [{ sourceId: 'doc.md', content }] }]
  });
}

it('public composition scopes errors and preserves exact text including frontmatter', () => {
  const analysis = analyze(
    '---\nid: ordinary\n---\n@stem:block(id:ok) body \r\n@stem:end()@stem:block(id:bad)@stem:include(missing)@stem:end()'
  );
  expect(
    compose(
      analysis,
      { kind: 'block', instance: analysis.localInstance!, reference: { id: 'ok' } },
      DEFAULT_COMPOSITION_LIMITS
    )
  ).toEqual({ content: ' body ', complete: true, diagnostics: [] });
  const file = compose(
    analysis,
    { kind: 'file', instance: analysis.localInstance!, sourceId: 'doc.md' },
    DEFAULT_COMPOSITION_LIMITS
  );
  expect(file.content).toBe('---\nid: ordinary\n---\n body ');
  expect(file.complete).toBe(false);
});
it('requires explicit limits and permits zero', () => {
  const analysis = analyze('@stem:block(id:a)text@stem:end()');
  const target = {
    kind: 'block' as const,
    instance: analysis.localInstance!,
    reference: { id: 'a' }
  };
  expect(compose(analysis, target, { maxWork: 0, maxOutputBytes: 0 })).toMatchObject({
    content: '',
    complete: false
  });
  expect(compose(analysis, target, { maxWork: -1, maxOutputBytes: 10 }).diagnostics[0]?.code).toBe(
    'INVALID_COMPOSITION_LIMITS'
  );
  expect(DEFAULT_COMPOSITION_LIMITS).toEqual({ maxWork: 100000, maxOutputBytes: 16777216 });
});
