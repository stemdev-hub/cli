import { describe, expect, it } from 'vitest';
import { parseMarkdownBody } from '../../src/core/parser/index.js';
import { runTwoPassParse } from '../../src/core/parser/two-pass.js';

describe('runTwoPassParse', () => {
  it('discovers sections and collects tags inside sections', () => {
    const result = runTwoPassParse(
      parseMarkdownBody(`@stem[section:auth-flow]
@stem[tag:summary]
Short auth summary.
@stem[end]
@stem[end]`)
    );

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.name).toBe('auth-flow');
    expect(result.sections[0]?.tags).toHaveLength(1);
    expect(result.sections[0]?.tags[0]?.content).toBe('Short auth summary.');
  });

  it('binds external tags to declared sections', () => {
    const result = runTwoPassParse(
      parseMarkdownBody(`@stem[section:auth-flow]
Section prose.
@stem[end]

@stem[tag:detail section=auth-flow]
External detail.
@stem[end]`)
    );

    expect(result.errors).toEqual([]);
    expect(result.sections[0]?.externalTags).toHaveLength(1);
    expect(result.sections[0]?.externalTags[0]?.name).toBe('detail');
    expect(result.sections[0]?.externalTags[0]?.content).toBe('External detail.');
  });

  it('returns EXTERNAL_TAG_MISSING_SECTION for missing section bindings', () => {
    const result = runTwoPassParse(
      parseMarkdownBody(`@stem[tag:detail section=missing]
External detail.
@stem[end]`),
      '/project/blocks/auth.md',
      'blocks/auth.md'
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe('EXTERNAL_TAG_MISSING_SECTION');
  });

  it('rejects external tags that name another block section', () => {
    const result = runTwoPassParse(
      parseMarkdownBody(`@stem[section:auth-flow]
@stem[end]

@stem[tag:detail section=other-block.auth-flow]
External detail.
@stem[end]`),
      '/project/blocks/auth.md',
      'blocks/auth.md'
    );

    expect(result.errors[0]).toMatchObject({
      code: 'EXTERNAL_TAG_MISSING_SECTION',
      context: { sectionName: 'other-block.auth-flow' }
    });
  });

  it('identifies standalone tags', () => {
    const result = runTwoPassParse(
      parseMarkdownBody(`@stem[tag:summary]
Standalone summary.
@stem[end]`)
    );

    expect(result.standaloneTags).toHaveLength(1);
    expect(result.standaloneTags[0]?.name).toBe('summary');
    expect(result.standaloneTags[0]?.content).toBe('Standalone summary.');
  });
});
