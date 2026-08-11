import { describe, expect, it } from 'vitest';

import type {
  BlockRef,
  ParsedBlock,
  ParsedView,
  Position,
  StemGraph,
  StemSection,
  StemTag
} from '../../src/core/types/index.js';
import { buildGraph } from '../../src/core/graph/builder.js';
import { validateGraph } from '../../src/core/validator/rules.js';

describe('validateGraph', () => {
  it('returns an empty array when no build issues are present', () => {
    const block = createBlock('auth-block');
    const view = createView('auth-view', [createBlockRef('auth-block')]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(createInput({ graph, blocks: [block], views: [view], orphanedBlocks: [] }));

    expect(issues).toEqual([]);
  });

  it('emits one DUPLICATE_ID issue per conflicting block path', () => {
    const issues = validateGraph(
      createInput({
        buildIssues: [
          {
            code: 'DUPLICATE_BLOCK_ID',
            id: 'auth-block',
            conflictingPaths: ['/project/blocks/a.md', '/project/blocks/b.md', '/project/blocks/c.md']
          }
        ]
      })
    );

    expect(issues).toMatchObject([
      {
        code: 'DUPLICATE_ID',
        filePath: '/project/blocks/a.md',
        context: { id: 'auth-block', collidingFilePath: '/project/blocks/b.md' }
      },
      {
        code: 'DUPLICATE_ID',
        filePath: '/project/blocks/a.md',
        context: { id: 'auth-block', collidingFilePath: '/project/blocks/c.md' }
      }
    ]);
  });

  it('emits DUPLICATE_ID issues for duplicate view IDs', () => {
    const issues = validateGraph(
      createInput({
        buildIssues: [
          {
            code: 'DUPLICATE_VIEW_ID',
            id: 'auth-view',
            conflictingPaths: ['/project/views/a.md', '/project/views/b.md']
          }
        ]
      })
    );

    expect(issues[0]).toMatchObject({
      code: 'DUPLICATE_ID',
      severity: 'error',
      filePath: '/project/views/a.md',
      context: { collidingFilePath: '/project/views/b.md' }
    });
  });

  it('sets duplicate ID severity to error', () => {
    const issues = validateGraph(
      createInput({
        buildIssues: [
          {
            code: 'DUPLICATE_BLOCK_ID',
            id: 'auth-block',
            conflictingPaths: ['/project/blocks/a.md', '/project/blocks/b.md']
          }
        ]
      })
    );

    expect(issues[0]?.severity).toBe('error');
  });

  it('does not emit BROKEN_BLOCK_REF when all block refs resolve', () => {
    const block = createBlock('auth-block');
    const view = createView('auth-view', [createBlockRef('auth-block')]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(createInput({ graph, blocks: [block], views: [view], orphanedBlocks: [] }));

    expect(issues.filter((issue) => issue.code === 'BROKEN_BLOCK_REF')).toEqual([]);
  });

  it('emits BROKEN_BLOCK_REF when a view references a missing block', () => {
    const view = createView('auth-view', [createBlockRef('missing-block')]);
    const graph = createGraph([], [view]);

    const issues = validateGraph(createInput({ graph, views: [view] }));

    expect(issues[0]).toMatchObject({
      code: 'BROKEN_BLOCK_REF',
      severity: 'error',
      filePath: '/project/views/auth-view.md',
      relativePath: 'views/auth-view.md',
      context: { targetId: 'missing-block', rawRef: '@stem[block:missing-block]' }
    });
  });

  it('includes position on BROKEN_BLOCK_REF issues', () => {
    const view = createView('auth-view', [createBlockRef('missing-block')]);
    const graph = createGraph([], [view]);

    const issues = validateGraph(createInput({ graph, views: [view] }));

    expect(issues[0]?.position).toEqual(POSITION);
  });

  it('does not emit BROKEN_SECTION_REF when the referenced section exists', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow')]
    });
    const view = createView('auth-view', [createBlockRef('auth-block', { section: 'auth-flow' })]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(createInput({ graph, blocks: [block], views: [view], orphanedBlocks: [] }));

    expect(issues.filter((issue) => issue.code === 'BROKEN_SECTION_REF')).toEqual([]);
  });

  it('emits BROKEN_SECTION_REF when the referenced section does not exist', () => {
    const block = createBlock('auth-block');
    const view = createView('auth-view', [createBlockRef('auth-block', { section: 'missing-section' })]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(createInput({ graph, blocks: [block], views: [view], orphanedBlocks: [] }));

    expect(issues[0]).toMatchObject({
      code: 'BROKEN_SECTION_REF',
      severity: 'error',
      context: { targetId: 'auth-block', targetSection: 'missing-section' }
    });
  });

  it('does not emit BROKEN_SECTION_REF when the block itself is missing', () => {
    const view = createView('auth-view', [createBlockRef('missing-block', { section: 'auth-flow' })]);
    const graph = createGraph([], [view]);

    const issues = validateGraph(createInput({ graph, views: [view] }));

    expect(issues.filter((issue) => issue.code === 'BROKEN_SECTION_REF')).toEqual([]);
  });

  it('does not emit UNRESOLVED_TAG when the tag exists in the section', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('summary')] })]
    });
    const view = createView('auth-view', [createBlockRef('auth-block', { section: 'auth-flow', tag: 'summary' })]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(createInput({ graph, blocks: [block], views: [view], orphanedBlocks: [] }));

    expect(issues.filter((issue) => issue.code === 'UNRESOLVED_TAG')).toEqual([]);
  });

  it('emits UNRESOLVED_TAG when the tag is not found in the section', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('detail')] })]
    });
    const view = createView('auth-view', [createBlockRef('auth-block', { section: 'auth-flow', tag: 'summary' })]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(createInput({ graph, blocks: [block], views: [view], orphanedBlocks: [] }));

    expect(issues[0]).toMatchObject({
      code: 'UNRESOLVED_TAG',
      severity: 'error',
      context: { targetId: 'auth-block', targetSection: 'auth-flow', missingTag: 'summary' }
    });
  });

  it('does not emit UNRESOLVED_TAG when the section is missing', () => {
    const block = createBlock('auth-block');
    const view = createView('auth-view', [createBlockRef('auth-block', { section: 'missing-section', tag: 'summary' })]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(createInput({ graph, blocks: [block], views: [view] }));

    expect(issues.filter((issue) => issue.code === 'UNRESOLVED_TAG')).toEqual([]);
  });

  it('emits INVALID_BLOCK_REF_FILTER when a block reference has a tag without a section', () => {
    const block = createBlock('auth-block');
    const view = createView('auth-view', [createBlockRef('auth-block', { tag: 'summary' })]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(createInput({ graph, blocks: [block], views: [view], orphanedBlocks: [] }));

    expect(issues[0]).toMatchObject({
      code: 'INVALID_BLOCK_REF_FILTER',
      severity: 'error',
      message: 'Block reference "@stem[block:auth-block tag=summary]" uses a tag filter without a section filter.',
      context: { targetId: 'auth-block', rawRef: '@stem[block:auth-block tag=summary]' }
    });
  });

  it('does not emit CIRCULAR_DEPENDENCY when cycles array is empty', () => {
    const issues = validateGraph(createInput({ cycles: [] }));

    expect(issues.filter((issue) => issue.code === 'CIRCULAR_DEPENDENCY')).toEqual([]);
  });

  it('emits a CIRCULAR_DEPENDENCY warning per cycle', () => {
    const block = createBlock('block-a');
    const graph = createGraph([block], []);

    const issues = validateGraph(createInput({ graph, blocks: [block], cycles: [['block-a', 'block-b', 'block-a']] }));

    expect(issues[0]).toMatchObject({
      code: 'CIRCULAR_DEPENDENCY',
      severity: 'warning',
      context: { dependencyChain: 'block-a -> block-b -> block-a' }
    });
  });

  it('does not emit ORPHANED_BLOCK when orphanedBlocks array is empty', () => {
    const issues = validateGraph(createInput({ orphanedBlocks: [] }));

    expect(issues.filter((issue) => issue.code === 'ORPHANED_BLOCK')).toEqual([]);
  });

  it('emits an ORPHANED_BLOCK warning per orphaned block id', () => {
    const block = createBlock('auth-block');
    const graph = createGraph([block], []);

    const issues = validateGraph(createInput({ graph, blocks: [block], orphanedBlocks: ['auth-block'] }));

    expect(issues[0]).toMatchObject({
      code: 'ORPHANED_BLOCK',
      severity: 'warning',
      filePath: '/project/blocks/auth-block.md',
      context: { blockId: 'auth-block' }
    });
  });

  it('does not emit DUPLICATE_TAG_IN_SECTION when tags are unique', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('summary')], externalTags: [createTag('detail')] })]
    });
    const graph = createGraph([block], []);

    const issues = validateGraph(createInput({ graph, blocks: [block] }));

    expect(issues.filter((issue) => issue.code === 'DUPLICATE_TAG_IN_SECTION')).toEqual([]);
  });

  it('emits DUPLICATE_TAG_IN_SECTION when the same tag appears twice in one section', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('summary'), createTag('summary')] })]
    });
    const graph = createGraph([block], []);

    const issues = validateGraph(createInput({ graph, blocks: [block] }));

    expect(issues[0]).toMatchObject({
      code: 'DUPLICATE_TAG_IN_SECTION',
      severity: 'warning',
      context: { tagName: 'summary', sectionName: 'auth-flow' }
    });
  });

  it('checks duplicate tags across section tags and external tags combined', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('summary')], externalTags: [createTag('summary')] })]
    });
    const graph = createGraph([block], []);

    const issues = validateGraph(createInput({ graph, blocks: [block] }));

    expect(issues.filter((issue) => issue.code === 'DUPLICATE_TAG_IN_SECTION')).toHaveLength(1);
  });

  it('returns combined results from all rules', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('summary'), createTag('summary')] })]
    });
    const view = createView('auth-view', [createBlockRef('missing-block', { tag: 'summary' })]);
    const graph = createGraph([block], [view]);

    const issues = validateGraph(
      createInput({
        graph,
        blocks: [block],
        views: [view],
        buildIssues: [
          {
            code: 'DUPLICATE_BLOCK_ID',
            id: 'auth-block',
            conflictingPaths: ['/project/blocks/a.md', '/project/blocks/b.md']
          }
        ],
        cycles: [['auth-block', 'auth-block']],
        orphanedBlocks: ['auth-block']
      })
    );

    expect(issues.map((issue) => issue.code)).toEqual([
      'DUPLICATE_ID',
      'BROKEN_BLOCK_REF',
      'INVALID_BLOCK_REF_FILTER',
      'CIRCULAR_DEPENDENCY',
      'ORPHANED_BLOCK',
      'DUPLICATE_TAG_IN_SECTION'
    ]);
  });

  it('emits issues with code, severity, message, filePath, relativePath, and context', () => {
    const view = createView('auth-view', [createBlockRef('missing-block')]);
    const graph = createGraph([], [view]);

    const issue = validateGraph(createInput({ graph, views: [view] }))[0];

    expect(issue).toMatchObject({
      code: 'BROKEN_BLOCK_REF',
      severity: 'error',
      message: 'View references missing block "missing-block".',
      filePath: '/project/views/auth-view.md',
      relativePath: 'views/auth-view.md',
      context: { targetId: 'missing-block', rawRef: '@stem[block:missing-block]' }
    });
  });
});

const POSITION: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 2 }
};

function createInput(overrides: Partial<Parameters<typeof validateGraph>[0]> = {}): Parameters<typeof validateGraph>[0] {
  const graph = overrides.graph ?? createGraph([], []);

  return {
    graph,
    blocks: [],
    views: [],
    buildIssues: [],
    schemas: new Map(),
    cycles: [],
    orphanedBlocks: [],
    ...overrides
  };
}

function createGraph(blocks: ParsedBlock[], views: ParsedView[]): StemGraph {
  return buildGraph(blocks, views).graph;
}

function createBlock(id: string, overrides: Partial<ParsedBlock> = {}): ParsedBlock {
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

function createBlockRef(
  blockId: string,
  overrides: Partial<Omit<BlockRef, 'blockId' | 'raw' | 'position'>> = {}
): BlockRef {
  const section = overrides.section ?? null;
  const tag = overrides.tag ?? null;
  const sectionParam = section === null ? '' : ` section=${section}`;
  const tagParam = tag === null ? '' : ` tag=${tag}`;

  return {
    blockId,
    section,
    tag,
    parameters: overrides.parameters ?? [],
    syntax: overrides.syntax ?? 'legacy',
    raw: `@stem[block:${blockId}${sectionParam}${tagParam}]`,
    position: POSITION
  };
}

function createSection(
  name: string,
  overrides: Partial<Omit<StemSection, 'name' | 'position' | 'prose'>> = {}
): StemSection {
  return {
    name,
    tags: overrides.tags ?? [],
    externalTags: overrides.externalTags ?? [],
    prose: '',
    proseRange: { startOffset: 0, endOffset: 0 },
    position: POSITION
  };
}

function createTag(name: string, content: string = ''): StemTag {
  return {
    name,
    section: null,
    content,
    contentRange: { startOffset: 0, endOffset: content.length },
    position: POSITION
  };
}
