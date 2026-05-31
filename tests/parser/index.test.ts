import { describe, expect, it } from 'vitest';
import { parseBlockFile, parseViewFile } from '../../src/core/parser/index.js';

describe('parser integration', () => {
  it('parses complete block content supplied by the fs layer', () => {
    const parsed = parseBlockFile({
      filePath: '/project/blocks/auth.md',
      relativePath: 'blocks/auth.md',
      content: `---
id: auth-flow-block
tags: [auth]
depends-on:
  - users-table-block#schema.summary
---

@stem[section:auth-flow]
@stem[tag:summary]
Authentication summary.
@stem[end]
@stem[end]

\`@stem[tag:ignored]\`
`
    });

    expect(parsed.errors).toEqual([]);
    expect(parsed.id).toBe('auth-flow-block');
    expect(parsed.tags).toEqual(['auth']);
    expect(parsed.dependsOn[0]).toEqual({
      blockId: 'users-table-block',
      section: 'schema',
      tag: 'summary',
      raw: 'users-table-block#schema.summary'
    });
    expect(parsed.sections[0]?.tags[0]?.content).toBe('Authentication summary.');
    expect(parsed.standaloneTags).toEqual([]);
  });

  it('parses complete view content supplied by the fs layer', () => {
    const parsed = parseViewFile({
      filePath: '/project/views/view.md',
      relativePath: 'views/view.md',
      content: `---
id: auth-service-view
group: by-audience/backend
---

# Auth Service

@stem[block:auth-flow-block section=auth-flow tag=summary]

\`\`\`md
@stem[block:ignored]
\`\`\`
`
    });

    expect(parsed.errors).toEqual([]);
    expect(parsed.id).toBe('auth-service-view');
    expect(parsed.group).toBe('by-audience/backend');
    expect(parsed.blockRefs).toHaveLength(1);
    expect(parsed.blockRefs[0]).toMatchObject({
      blockId: 'auth-flow-block',
      section: 'auth-flow',
      tag: 'summary'
    });
  });

  it('preserves local view content alongside block references', () => {
    const parsed = parseViewFile({
      filePath: '/project/views/view.md',
      relativePath: 'views/view.md',
      content: `---
id: auth-service-view
---

# Auth Service

Local introduction.

@stem[block:auth-flow-block]`
    });

    expect(parsed.localContent).toContain('Local introduction.');
    expect(parsed.blockRefs).toHaveLength(1);
  });

  it('parses plain block prose without sections or tags', () => {
    const parsed = parseBlockFile({
      filePath: '/project/blocks/plain.md',
      relativePath: 'blocks/plain.md',
      content: `---
id: plain-block
---

Plain Markdown only.`
    });

    expect(parsed.errors).toEqual([]);
    expect(parsed.sections).toEqual([]);
    expect(parsed.standaloneTags).toEqual([]);
    expect(parsed.rawContent.trim()).toBe('Plain Markdown only.');
  });

  it('collects recoverable errors rather than throwing', () => {
    const parsed = parseBlockFile({
      filePath: '/project/blocks/broken.md',
      relativePath: 'blocks/broken.md',
      content: `---
tags: [auth]
---

@stem[tag:detail section=missing]
Detail.
@stem[end]
`
    });

    expect(parsed.errors.map((error) => error.code)).toEqual([
      'INVALID_FRONTMATTER',
      'EXTERNAL_TAG_MISSING_SECTION'
    ]);
  });
});
