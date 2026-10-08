import { describe, expect, it } from 'vitest';

import { analyzeProject } from '../../src/index.js';
import type { ProjectSnapshot, SourceDocument } from '../../src/index.js';

const expiryMs = 7 * 24 * 60 * 60 * 1000;

function document(relativePath: string, content: string): SourceDocument {
  return { content, filePath: `/project/${relativePath}`, relativePath };
}

function snapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    blocks: [document('blocks/auth.md', '---\nid: auth\n---\nHello.')],
    views: [document('views/api.md', '---\nid: api\n---\n@stem[block:auth]')],
    schemas: new Map(),
    configuredNamespaces: {},
    externalGraphs: new Map(),
    ...overrides
  };
}

function externalSnapshot(): ProjectSnapshot {
  return snapshot({
    views: [document('views/api.md', '---\nid: api\n---\n@stem[block:auth]\n@stem[block:other:remote]')],
    configuredNamespaces: { other: { graphUrl: 'https://example.com/graph.json' } },
    externalGraphs: new Map([['other', {
      fetchedAt: '1970-01-01T00:00:00.000Z',
      isLocalFallback: false,
      graph: {
        version: '1', namespace: 'other', publishedAt: '', contentSha: '',
        blocks: [{ id: 'remote', tags: ['api'], sections: [{ id: 'summary', tags: ['api'] }] }],
        renames: [{ from: 'old', to: 'remote', since: '1970-01-01' }]
      }
    }]])
  });
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  if (value instanceof Map) {
    for (const [key, entry] of value as Map<unknown, unknown>) {
      deepFreeze(key);
      deepFreeze(entry);
    }
    for (const method of ['set', 'delete', 'clear']) {
      Object.defineProperty(value, method, {
        value: () => { throw new Error('Cannot mutate frozen snapshot map'); }
      });
    }
  } else {
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  Object.freeze(value);
}

describe('analyzeProject', () => {
  it('parses a clean project and returns its graph and validation', () => {
    const result = analyzeProject(snapshot(), { nowMs: 0 });
    expect(result.blocks.map((block) => block.id)).toEqual(['auth']);
    expect(result.views.map((view) => view.id)).toEqual(['api']);
    expect(result.blocks[0]).not.toHaveProperty('errors');
    expect(result.views[0]).not.toHaveProperty('errors');
    expect([...result.graph.nodes.keys()]).toEqual(['auth', 'api']);
    expect(result.graph.edges).toEqual([
      { type: 'view-uses-block', from: 'api', to: 'auth', section: null, tag: null }
    ]);
    expect(result.validation).toEqual({
      issues: [], errorCount: 0, warningCount: 0, hasErrors: false, hasWarnings: false
    });
  });

  it('keeps block parser issues before view parser issues in supplied document order', () => {
    const input = snapshot({
      blocks: [document('blocks/z.md', '---\nid: z\n---\n@stem[tag:api section=missing]\nx\n@stem[end]'),
        document('blocks/a.md', '---\nid: a\n---\n@stem[tag:api section=missing]\nx\n@stem[end]')],
      views: [document('views/z.md', '---\nid: z-view\n---\n@stem[tag:api section=missing]\nx\n@stem[end]'),
        document('views/a.md', '---\nid: a-view\n---\n@stem[tag:api section=missing]\nx\n@stem[end]')]
    });
    const { issues } = analyzeProject(input, { nowMs: 0 }).validation;
    expect(issues.slice(0, 4).map((issue) => [issue.code, issue.relativePath])).toEqual([
      ['EXTERNAL_TAG_MISSING_SECTION', 'blocks/z.md'],
      ['EXTERNAL_TAG_MISSING_SECTION', 'blocks/a.md'],
      ['EXTERNAL_TAG_MISSING_SECTION', 'views/z.md'],
      ['EXTERNAL_TAG_MISSING_SECTION', 'views/a.md']
    ]);
  });

  it('reports dependency cycles', () => {
    const input = snapshot({
      blocks: [
        document('blocks/auth.md', '---\nid: auth\ndepends-on: [other]\n---\nAuth.'),
        document('blocks/other.md', '---\nid: other\ndepends-on: [auth]\n---\nOther.')
      ],
      views: [document('views/api.md', '---\nid: api\n---\n@stem[block:auth]\n@stem[block:other]')]
    });
    expect(analyzeProject(input, { nowMs: 0 }).validation.issues).toEqual([
      expect.objectContaining({ code: 'CIRCULAR_DEPENDENCY', severity: 'warning' })
    ]);
  });

  it('reports an orphan with warning counts', () => {
    const result = analyzeProject(snapshot({ views: [] }), { nowMs: 0 });
    expect(result.validation).toEqual({
      issues: [expect.objectContaining({ code: 'ORPHANED_BLOCK', severity: 'warning' })],
      errorCount: 0, warningCount: 1, hasErrors: false, hasWarnings: true
    });
  });

  it('orders parser, build, external, graph and schema issues without sorting or deduplication', () => {
    const input = snapshot({
      blocks: [document('blocks/auth.md', '---\nid: auth\n---\n@stem[tag:api section=missing]\nendpoint\n@stem[end]\n@stem[tag:api]\nendpoint\n@stem[end]'),
        document('blocks/duplicate.md', '---\nid: auth\n---\nDuplicate.')],
      views: [document('views/api.md', '---\nid: api\n---\n@stem[block:missing]\n@stem[block:other:remote]\n@stem[block:auth]')],
      schemas: new Map([['api', { name: 'api', required: ['endpoint', 'response'] }]])
    });
    const result = analyzeProject(input, { nowMs: 0 });
    expect(result.validation.issues.map((issue) => issue.code)).toEqual([
      'EXTERNAL_TAG_MISSING_SECTION', 'DUPLICATE_ID', 'UNRESOLVED_NAMESPACE',
      'BROKEN_BLOCK_REF', 'SCHEMA_VIOLATION', 'SCHEMA_VIOLATION'
    ]);
    expect(result.validation).toMatchObject({ errorCount: 5, warningCount: 1, hasErrors: true, hasWarnings: true });
    expect(result.validation.issues.slice(-2)).toEqual([
      expect.objectContaining({ context: { tagName: 'api', missingSections: 'response' } }),
      expect.objectContaining({ context: { tagName: 'api', missingSections: 'response' } })
    ]);
  });

  it.each([-1, 0, 1])('preserves the strict greater-than expiry boundary at expiry %i ms', (offset) => {
    const { validation } = analyzeProject(externalSnapshot(), { nowMs: expiryMs + offset });
    expect(validation.issues.map((issue) => issue.code)).toEqual(offset > 0 ? ['EXPIRED_SNAPSHOT'] : []);
  });

  it('does not expire a local fallback snapshot', () => {
    const input = externalSnapshot();
    input.externalGraphs.get('other')!.isLocalFallback = true;
    expect(analyzeProject(input, { nowMs: expiryMs + 1 }).validation.issues).toEqual([]);
  });

  it.each(['unresolved', 'missing', 'expired'] as const)('preserves strictExternal handling for %s snapshots', (state) => {
    const input = externalSnapshot();
    if (state === 'unresolved') input.configuredNamespaces = {};
    if (state === 'missing') input.externalGraphs.clear();
    const options = { nowMs: expiryMs + 1 };
    const normal = analyzeProject(input, options).validation;
    expect(normal).toMatchObject({ errorCount: 0, warningCount: 1, hasErrors: false, hasWarnings: true });
    expect(analyzeProject(input, { ...options, strictExternal: false }).validation).toEqual(normal);
    expect(analyzeProject(input, { ...options, strictExternal: true }).validation).toEqual({
      issues: normal.issues.map((issue) => ({ ...issue, severity: 'error' })),
      errorCount: 1, warningCount: 0, hasErrors: true, hasWarnings: false
    });
  });

  it('does not mutate a deeply frozen input snapshot, including map entries', () => {
    const input = externalSnapshot();
    input.blocks[0]!.content += '\n@stem[tag:api]\nendpoint\n@stem[end]';
    input.schemas.set('api', { name: 'api', required: ['endpoint', 'response'] });
    const before = structuredClone(input);
    deepFreeze(input);
    analyzeProject(input, { nowMs: expiryMs + 1, strictExternal: true });
    expect(input).toEqual(before);
    expect(() => input.schemas.clear()).toThrow('Cannot mutate frozen snapshot map');
    expect(() => input.externalGraphs.clear()).toThrow('Cannot mutate frozen snapshot map');
  });

  it('returns equal results for two identical calls', () => {
    const input = externalSnapshot();
    const options = { nowMs: expiryMs + 1, strictExternal: true };
    expect(analyzeProject(input, options)).toEqual(analyzeProject(input, options));
  });
});
