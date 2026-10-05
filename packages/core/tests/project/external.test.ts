import { describe, expect, it } from 'vitest';
import { decodeExternalSnapshotEnvelope } from '../../src/index.js';

const block = { id: 'auth', tags: ['api'], sections: [{ id: 'summary', tags: ['api'] }] };
const rename = { from: 'old', to: 'auth', since: '2026-01-01' };
const graph = {
  version: '1', namespace: 'api', publishedAt: '', contentSha: '', blocks: [block], renames: [rename]
};

describe('decodeExternalSnapshotEnvelope', () => {
  it.each([undefined, null, '', '# comment', 'null', 42, [], {}])('ignores a non-envelope value: %j', (value) => {
    expect(decodeExternalSnapshotEnvelope(value)).toBeUndefined();
  });

  it.each([undefined, null, 123, false, [], {}])('ignores absent or non-string fetchedAt: %j', (fetchedAt) => {
    expect(decodeExternalSnapshotEnvelope({ graph, fetchedAt })).toBeUndefined();
  });

  it.each(['2026-08-19T10:00:00.000Z', '', 'not a date'])('accepts any string fetchedAt: %j', (fetchedAt) => {
    expect(decodeExternalSnapshotEnvelope({ graph, fetchedAt, isLocalFallback: true, extra: 'ignored' })).toEqual({
      graph, fetchedAt, isLocalFallback: false
    });
  });

  it('accepts empty graph arrays and ignores a legacy raw graph', () => {
    const emptyGraph = { ...graph, blocks: [], renames: [] };
    expect(decodeExternalSnapshotEnvelope({ graph: emptyGraph, fetchedAt: '' })).toEqual({
      graph: emptyGraph, fetchedAt: '', isLocalFallback: false
    });
    expect(decodeExternalSnapshotEnvelope(graph)).toBeUndefined();
  });

  it.each([undefined, null, 1, [], {}])('ignores a missing or non-graph value: %j', (value) => {
    expect(decodeExternalSnapshotEnvelope({ graph: value, fetchedAt: '' })).toBeUndefined();
  });

  it.each(['version', 'namespace', 'publishedAt', 'contentSha', 'blocks', 'renames'])('requires graph field %s', (field) => {
    const incomplete: Record<string, unknown> = { ...graph };
    delete incomplete[field];
    expect(decodeExternalSnapshotEnvelope({ graph: incomplete, fetchedAt: '' })).toBeUndefined();
  });

  it.each([
    { version: 1 }, { namespace: null }, { publishedAt: false }, { contentSha: [] },
    { blocks: null }, { renames: {} }, { blocks: [null] }, { blocks: [[]] },
    { blocks: [{ ...block, id: 1 }] }, { blocks: [{ ...block, tags: null }] },
    { blocks: [{ ...block, tags: [1] }] }, { blocks: [{ ...block, sections: {} }] },
    { blocks: [{ ...block, sections: [null] }] }, { blocks: [{ ...block, sections: [[]] }] },
    { blocks: [{ ...block, sections: [{ id: 1, tags: [] }] }] },
    { blocks: [{ ...block, sections: [{ id: 's', tags: null }] }] },
    { blocks: [{ ...block, sections: [{ id: 's', tags: [1] }] }] },
    { renames: [null] }, { renames: [[]] }, { renames: [{ ...rename, from: 1 }] },
    { renames: [{ ...rename, to: null }] }, { renames: [{ ...rename, since: 1 }] }
  ])('rejects malformed nested graph shapes: %j', (overrides) => {
    expect(decodeExternalSnapshotEnvelope({ graph: { ...graph, ...overrides }, fetchedAt: '' })).toBeUndefined();
  });

  it('reads a frozen envelope without changing it', () => {
    const envelope = Object.freeze({ graph: Object.freeze({ ...graph, blocks: Object.freeze([]), renames: Object.freeze([]) }), fetchedAt: '' });
    expect(decodeExternalSnapshotEnvelope(envelope)).toEqual({ ...envelope, isLocalFallback: false });
    expect(envelope).not.toHaveProperty('isLocalFallback');
  });
});
