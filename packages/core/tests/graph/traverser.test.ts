import { describe, expect, it } from 'vitest';

import type { BlockRef, DependencyRef, ParsedBlock, ParsedView, Position, StemGraph } from '../../src/types/index.js';
import { buildGraph } from '../../src/graph/builder.js';
import { createActivePath, detectCycles, getBlockDependencies, getBlockDependents, getDependencyChain, getOrphanedBlocks, getViewsUsingBlock } from '../../src/graph/traverser.js';

describe('active paths', () => {
  it('rejects a revisit without entering it and permits later independent reuse', () => {
    const path = createActivePath<string>();
    path.enter('parent');
    path.enter('child');
    const cycle = path.enter('parent');
    expect(cycle).toEqual(['parent', 'child', 'parent']);

    path.leave();
    expect(path.enter('child')).toBeUndefined();
    expect(path.enter('child')).toEqual(['child', 'child']);
    path.leave();
    path.leave();
    expect(path.enter('parent')).toBeUndefined();
    expect(cycle).toEqual(['parent', 'child', 'parent']);
  });

  it('distinguishes stable instance handles even when authored IDs are equal', () => {
    const first = { id: 'a', instance: {} };
    const second = { id: 'a', instance: {} };
    const path = createActivePath<typeof first>();

    expect(path.enter(first)).toBeUndefined();
    expect(path.enter(second)).toBeUndefined();
    expect(path.enter(first)).toEqual([first, second, first]);
    expect(createActivePath<typeof first>().enter(first)).toBeUndefined();
  });
});

describe('traverser', () => {
  it('getViewsUsingBlock returns view IDs for a used block', () => {
    const graph = createGraph(
      [createBlock('auth-block')],
      [
        createView('backend-view', [createBlockRef('auth-block')]),
        createView('frontend-view', [createBlockRef('auth-block')])
      ]
    );

    expect(getViewsUsingBlock(graph, 'auth-block')).toEqual(['backend-view', 'frontend-view']);
  });

  it('getViewsUsingBlock returns an empty array for an unused block', () => {
    const graph = createGraph([createBlock('auth-block')], []);

    expect(getViewsUsingBlock(graph, 'auth-block')).toEqual([]);
  });

  it('getViewsUsingBlock returns an empty array for an unknown block ID', () => {
    const graph = createGraph([], []);

    expect(getViewsUsingBlock(graph, 'missing-block')).toEqual([]);
  });

  it('getBlockDependencies returns dependency refs for a block', () => {
    const dependency = createDependency('users-block', { section: 'database', tag: 'api' });
    const graph = createGraph([createBlock('auth-block', [dependency])], []);

    expect(getBlockDependencies(graph, 'auth-block')).toEqual([dependency]);
  });

  it('getBlockDependencies returns an empty array for a block with no dependencies', () => {
    const graph = createGraph([createBlock('auth-block')], []);

    expect(getBlockDependencies(graph, 'auth-block')).toEqual([]);
  });

  it('getBlockDependencies returns an empty array for an unknown block ID', () => {
    const graph = createGraph([], []);

    expect(getBlockDependencies(graph, 'missing-block')).toEqual([]);
  });

  it('getBlockDependents returns dependent block IDs', () => {
    const graph = createGraph([createBlock('auth-block', [createDependency('users-block')])], []);

    expect(getBlockDependents(graph, 'users-block')).toEqual(['auth-block']);
  });

  it('getBlockDependents returns an empty array for a block with no dependents', () => {
    const graph = createGraph([createBlock('auth-block')], []);

    expect(getBlockDependents(graph, 'auth-block')).toEqual([]);
  });

  it('getBlockDependents returns an empty array for an unknown block ID', () => {
    const graph = createGraph([], []);

    expect(getBlockDependents(graph, 'missing-block')).toEqual([]);
  });

  it('detectCycles returns an empty array for an acyclic graph', () => {
    const graph = createGraph([
      createBlock('auth-block', [createDependency('users-block')]),
      createBlock('users-block')
    ]);

    expect(detectCycles(graph)).toEqual([]);
  });

  it('detectCycles detects a direct cycle', () => {
    const graph = createGraph([
      createBlock('block-a', [createDependency('block-b')]),
      createBlock('block-b', [createDependency('block-a')])
    ]);

    expect(detectCycles(graph)).toEqual([['block-a', 'block-b', 'block-a']]);
  });

  it('detectCycles detects an indirect cycle', () => {
    const graph = createGraph([
      createBlock('block-a', [createDependency('block-b')]),
      createBlock('block-b', [createDependency('block-c')]),
      createBlock('block-c', [createDependency('block-a')])
    ]);

    expect(detectCycles(graph)).toEqual([['block-a', 'block-c', 'block-b', 'block-a']]);
  });

  it('detectCycles does not infinite loop on a cyclic graph', () => {
    const graph = createGraph([
      createBlock('block-a', [createDependency('block-b')]),
      createBlock('block-b', [createDependency('block-a')])
    ]);

    expect(detectCycles(graph)).toHaveLength(1);
  });

  it('detectCycles returns cycle paths with the start node at the end', () => {
    const graph = createGraph([
      createBlock('block-a', [createDependency('block-b')]),
      createBlock('block-b', [createDependency('block-a')])
    ]);

    const cycle = detectCycles(graph)[0];

    expect(cycle?.[0]).toBe(cycle?.[cycle.length - 1]);
  });

  it('does not treat converging independent paths as a cycle', () => {
    const graph = createGraph([
      createBlock('root'),
      createBlock('left', [createDependency('root')]),
      createBlock('right', [createDependency('root')]),
      createBlock('shared', [createDependency('left'), createDependency('right')])
    ]);

    expect(detectCycles(graph)).toEqual([]);
  });

  it('finds self-cycles and independent cycles without retaining traversal state', () => {
    const graph = createGraph([
      createBlock('self', [createDependency('self')]),
      createBlock('a', [createDependency('b')]),
      createBlock('b', [createDependency('a')])
    ]);
    const original = structuredClone(graph);
    const expected = [['self', 'self'], ['a', 'b', 'a']];

    expect(detectCycles(graph)).toEqual(expected);
    expect(detectCycles(graph)).toEqual(expected);
    expect(graph).toEqual(original);
  });

  it('checks a deep acyclic graph without exhausting the call stack', () => {
    const graph = createGraph(Array.from({ length: 20000 }, (_, index) =>
      createBlock(`node-${index}`, index === 0 ? [] : [createDependency(`node-${index - 1}`)])
    ));

    expect(detectCycles(graph)).toEqual([]);
  });

  it('reports a long cycle without materializing every rotation', () => {
    const count = 12000;
    const graph = createGraph(Array.from({ length: count }, (_, index) =>
      createBlock(`node-${index}`, [createDependency(`node-${(index + count - 1) % count}`)])
    ));
    const cycles = detectCycles(graph);

    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual([
      ...Array.from({ length: count }, (_, index) => `node-${index}`), 'node-0'
    ]);
  });

  it('getOrphanedBlocks returns block IDs with no view references', () => {
    const graph = createGraph(
      [createBlock('used-block'), createBlock('orphaned-block')],
      [createView('view-a', [createBlockRef('used-block')])]
    );

    expect(getOrphanedBlocks(graph)).toEqual(['orphaned-block']);
  });

  it('getOrphanedBlocks returns an empty array when all blocks are used', () => {
    const graph = createGraph([createBlock('used-block')], [createView('view-a', [createBlockRef('used-block')])]);

    expect(getOrphanedBlocks(graph)).toEqual([]);
  });

  it('getDependencyChain returns the full recursive chain in dependents direction', () => {
    const graph = createGraph([
      createBlock('block-a'),
      createBlock('block-b', [createDependency('block-a')]),
      createBlock('block-c', [createDependency('block-b')])
    ]);

    expect(getDependencyChain(graph, 'block-a', 'dependents')).toEqual(['block-b', 'block-c']);
  });

  it('getDependencyChain returns the full recursive chain in dependencies direction', () => {
    const graph = createGraph([
      createBlock('block-a', [createDependency('block-b')]),
      createBlock('block-b', [createDependency('block-c')]),
      createBlock('block-c')
    ]);

    expect(getDependencyChain(graph, 'block-a', 'dependencies')).toEqual(['block-b', 'block-c']);
  });

  it('getDependencyChain handles cycles without infinite loop', () => {
    const graph = createGraph([
      createBlock('block-a', [createDependency('block-b')]),
      createBlock('block-b', [createDependency('block-a')])
    ]);

    expect(getDependencyChain(graph, 'block-a', 'dependencies')).toEqual(['block-b']);
  });

  it('getDependencyChain does not include the starting block ID in the result', () => {
    const graph = createGraph([
      createBlock('block-a', [createDependency('block-b')]),
      createBlock('block-b', [createDependency('block-a')])
    ]);

    expect(getDependencyChain(graph, 'block-a', 'dependencies')).not.toContain('block-a');
  });

  it('getDependencyChain returns deduplicated results', () => {
    const graph = createGraph([
      createBlock('block-a'),
      createBlock('block-b', [createDependency('block-a')]),
      createBlock('block-c', [createDependency('block-a')]),
      createBlock('block-d', [createDependency('block-b'), createDependency('block-c')])
    ]);

    expect(getDependencyChain(graph, 'block-a', 'dependents')).toEqual(['block-b', 'block-d', 'block-c']);
  });
});

const POSITION: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 2 }
};

function createGraph(blocks: ParsedBlock[], views: ParsedView[] = []): StemGraph {
  return buildGraph(blocks, views).graph;
}

function createBlock(id: string, dependsOn: DependencyRef[] = []): ParsedBlock {
  return {
    id,
    tags: [],
    dependsOn,
    sections: [],
    standaloneTags: [],
    filePath: `/project/blocks/${id}.md`,
    relativePath: `blocks/${id}.md`,
    rawContent: '',
    bodyStartLine: 1
  };
}

function createView(id: string, blockRefs: BlockRef[] = []): ParsedView {
  return {
    id,
    group: null,
    blockRefs,
    filePath: `/project/views/${id}.md`,
    relativePath: `views/${id}.md`,
    localContent: '',
    bodyStartLine: 1
  };
}

function createBlockRef(blockId: string): BlockRef {
  return {
    namespace: null,
    blockId,
    section: null,
    tag: null,
    parameters: [],
    syntax: 'legacy',
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
