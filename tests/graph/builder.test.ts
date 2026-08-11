import { describe, expect, it } from 'vitest';

import type { BlockRef, DependencyRef, ParsedBlock, ParsedView, Position } from '../../src/core/types/index.js';
import { buildGraph } from '../../src/core/graph/builder.js';

describe('buildGraph', () => {
  it('builds an empty graph from empty blocks and views arrays', () => {
    const result = buildGraph([], []);

    expect(result.issues).toEqual([]);
    expect(result.graph.nodes.size).toBe(0);
    expect(result.graph.edges).toEqual([]);
    expect(result.graph.blockUsedInViews.size).toBe(0);
    expect(result.graph.viewUsesBlocks.size).toBe(0);
    expect(result.graph.blockDependsOn.size).toBe(0);
    expect(result.graph.blockDependents.size).toBe(0);
  });

  it('creates a block node with block metadata', () => {
    const block = createBlock({ id: 'auth-block', tags: ['auth', 'backend'] });

    const result = buildGraph([block], []);

    expect(result.graph.nodes.get('auth-block')).toEqual({
      id: 'auth-block',
      type: 'block',
      filePath: '/project/blocks/auth-block.md',
      relativePath: 'blocks/auth-block.md',
      tags: ['auth', 'backend'],
      group: null
    });
  });

  it('creates a view node with view metadata', () => {
    const view = createView({ id: 'auth-view', group: 'backend' });

    const result = buildGraph([], [view]);

    expect(result.graph.nodes.get('auth-view')).toEqual({
      id: 'auth-view',
      type: 'view',
      filePath: '/project/views/auth-view.md',
      relativePath: 'views/auth-view.md',
      tags: [],
      group: 'backend'
    });
  });

  it('creates a view-uses-block edge for each block reference in a view', () => {
    const view = createView({
      blockRefs: [createBlockRef('auth-block'), createBlockRef('billing-block')]
    });

    const result = buildGraph([], [view]);

    expect(result.graph.edges).toEqual([
      { type: 'view-uses-block', from: 'view-a', to: 'auth-block', section: null, tag: null },
      { type: 'view-uses-block', from: 'view-a', to: 'billing-block', section: null, tag: null }
    ]);
  });

  it('preserves section and tag metadata on view-uses-block edges', () => {
    const view = createView({
      blockRefs: [createBlockRef('auth-block', { section: 'auth-flow', tag: 'summary' })]
    });

    const result = buildGraph([], [view]);

    expect(result.graph.edges[0]).toEqual({
      type: 'view-uses-block',
      from: 'view-a',
      to: 'auth-block',
      section: 'auth-flow',
      tag: 'summary'
    });
  });

  it('creates multiple edges for multiple references to the same block from one view', () => {
    const view = createView({
      blockRefs: [
        createBlockRef('auth-block', { section: 'auth-flow', tag: 'summary' }),
        createBlockRef('auth-block', { section: 'auth-flow', tag: 'detail' })
      ]
    });

    const result = buildGraph([], [view]);

    expect(result.graph.edges).toHaveLength(2);
    expect(result.graph.edges.map((edge) => edge.tag)).toEqual(['summary', 'detail']);
  });

  it('creates an unfiltered block reference edge with null section and tag', () => {
    const view = createView({ blockRefs: [createBlockRef('auth-block')] });

    const result = buildGraph([], [view]);

    expect(result.graph.edges[0]).toMatchObject({ section: null, tag: null });
  });

  it('creates a block-depends-on edge for each dependency reference', () => {
    const block = createBlock({
      dependsOn: [createDependency('users-block'), createDependency('tokens-block')]
    });

    const result = buildGraph([block], []);

    expect(result.graph.edges).toEqual([
      { type: 'block-depends-on', from: 'block-a', to: 'users-block', section: null, tag: null },
      { type: 'block-depends-on', from: 'block-a', to: 'tokens-block', section: null, tag: null }
    ]);
  });

  it('preserves section and tag metadata on block-depends-on edges', () => {
    const block = createBlock({
      dependsOn: [createDependency('users-block', { section: 'database', tag: 'api' })]
    });

    const result = buildGraph([block], []);

    expect(result.graph.edges[0]).toEqual({
      type: 'block-depends-on',
      from: 'block-a',
      to: 'users-block',
      section: 'database',
      tag: 'api'
    });
  });

  it('creates an edge to a non-existent block without collecting an issue', () => {
    const view = createView({ blockRefs: [createBlockRef('missing-block')] });

    const result = buildGraph([], [view]);

    expect(result.issues).toEqual([]);
    expect(result.graph.edges[0]).toMatchObject({ from: 'view-a', to: 'missing-block' });
  });

  it('populates blockUsedInViews', () => {
    const views = [
      createView({ id: 'view-a', blockRefs: [createBlockRef('auth-block')] }),
      createView({ id: 'view-b', blockRefs: [createBlockRef('auth-block')] })
    ];

    const result = buildGraph([], views);

    expect(result.graph.blockUsedInViews.get('auth-block')).toEqual(['view-a', 'view-b']);
  });

  it('populates viewUsesBlocks', () => {
    const view = createView({ blockRefs: [createBlockRef('auth-block'), createBlockRef('billing-block')] });

    const result = buildGraph([], [view]);

    expect(result.graph.viewUsesBlocks.get('view-a')).toEqual(['auth-block', 'billing-block']);
  });

  it('populates blockDependsOn', () => {
    const dependency = createDependency('users-block', { section: 'database', tag: 'api' });
    const block = createBlock({ dependsOn: [dependency] });

    const result = buildGraph([block], []);

    expect(result.graph.blockDependsOn.get('block-a')).toEqual([
      { blockId: 'users-block', section: 'database', tag: 'api', raw: 'users-block#database.api' }
    ]);
  });

  it('populates blockDependents', () => {
    const block = createBlock({ id: 'auth-block', dependsOn: [createDependency('users-block')] });

    const result = buildGraph([block], []);

    expect(result.graph.blockDependents.get('users-block')).toEqual(['auth-block']);
  });

  it('records DUPLICATE_BLOCK_ID when duplicate block IDs exist and keeps the first node', () => {
    const first = createBlock({ id: 'auth-block', filePath: '/project/blocks/first.md' });
    const second = createBlock({ id: 'auth-block', filePath: '/project/blocks/second.md' });

    const result = buildGraph([first, second], []);

    expect(result.graph.nodes.get('auth-block')?.filePath).toBe('/project/blocks/first.md');
    expect(result.issues).toEqual([
      {
        code: 'DUPLICATE_BLOCK_ID',
        id: 'auth-block',
        conflictingPaths: ['/project/blocks/first.md', '/project/blocks/second.md']
      }
    ]);
  });

  it('records DUPLICATE_VIEW_ID when duplicate view IDs exist and keeps the first node', () => {
    const first = createView({ id: 'auth-view', filePath: '/project/views/first.md' });
    const second = createView({ id: 'auth-view', filePath: '/project/views/second.md' });

    const result = buildGraph([], [first, second]);

    expect(result.graph.nodes.get('auth-view')?.filePath).toBe('/project/views/first.md');
    expect(result.issues).toEqual([
      {
        code: 'DUPLICATE_VIEW_ID',
        id: 'auth-view',
        conflictingPaths: ['/project/views/first.md', '/project/views/second.md']
      }
    ]);
  });

  it('creates a view node with no edges for a view with no block references', () => {
    const view = createView({ blockRefs: [] });

    const result = buildGraph([], [view]);

    expect(result.graph.nodes.has('view-a')).toBe(true);
    expect(result.graph.edges).toEqual([]);
  });

  it('creates a block node with no dependency edges for a block without dependencies', () => {
    const block = createBlock({ dependsOn: [] });

    const result = buildGraph([block], []);

    expect(result.graph.nodes.has('block-a')).toBe(true);
    expect(result.graph.edges).toEqual([]);
  });

  it('deduplicates lookup map arrays', () => {
    const view = createView({
      blockRefs: [
        createBlockRef('auth-block', { tag: 'summary' }),
        createBlockRef('auth-block', { tag: 'detail' })
      ]
    });
    const block = createBlock({
      dependsOn: [createDependency('users-block'), createDependency('users-block')]
    });

    const result = buildGraph([block], [view]);

    expect(result.graph.blockUsedInViews.get('auth-block')).toEqual(['view-a']);
    expect(result.graph.viewUsesBlocks.get('view-a')).toEqual(['auth-block']);
    expect(result.graph.blockDependents.get('users-block')).toEqual(['block-a']);
  });
});

const POSITION: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 2 }
};

function createBlock(overrides: Partial<ParsedBlock> = {}): ParsedBlock {
  const id = overrides.id ?? 'block-a';

  return {
    id,
    tags: [],
    dependsOn: [],
    sections: [],
    standaloneTags: [],
    filePath: `/project/blocks/${id}.md`,
    relativePath: `blocks/${id}.md`,
    rawContent: '',
    bodyStartLine: 1,
    ...overrides
  };
}

function createView(overrides: Partial<ParsedView> = {}): ParsedView {
  const id = overrides.id ?? 'view-a';

  return {
    id,
    group: null,
    blockRefs: [],
    filePath: `/project/views/${id}.md`,
    relativePath: `views/${id}.md`,
    localContent: '',
    bodyStartLine: 1,
    ...overrides
  };
}

function createBlockRef(
  blockId: string,
  overrides: Partial<Omit<BlockRef, 'blockId' | 'raw' | 'position'>> = {}
): BlockRef {
  return {
    blockId,
    section: overrides.section ?? null,
    tag: overrides.tag ?? null,
    parameters: overrides.parameters ?? [],
    syntax: overrides.syntax ?? 'legacy',
    raw: `@stem[block:${blockId}]`,
    position: POSITION
  };
}

function createDependency(
  blockId: string,
  overrides: Partial<Omit<DependencyRef, 'blockId' | 'raw'>> = {}
): DependencyRef {
  const section = overrides.section ?? null;
  const tag = overrides.tag ?? null;
  const scope = section === null ? '' : `#${section}${tag === null ? '' : `.${tag}`}`;

  return {
    blockId,
    section,
    tag,
    raw: `${blockId}${scope}`
  };
}
