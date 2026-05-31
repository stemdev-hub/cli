import { describe, expect, it } from 'vitest';
import {
  parseBlockFrontmatter,
  parseDependencyRef,
  parseViewFrontmatter
} from '../../src/core/parser/frontmatter.js';

describe('parseBlockFrontmatter', () => {
  it('extracts block id, tags, and dependencies', () => {
    const result = parseBlockFrontmatter(
      `---
id: auth-flow-block
tags: [auth, backend]
depends-on:
  - users-table-block
---

Body`,
      '/project/blocks/auth.md',
      'blocks/auth.md'
    );

    expect(result.errors).toEqual([]);
    expect(result.data.id).toBe('auth-flow-block');
    expect(result.data.tags).toEqual(['auth', 'backend']);
    expect(result.data.dependsOn).toEqual([
      { blockId: 'users-table-block', section: null, tag: null, raw: 'users-table-block' }
    ]);
    expect(result.body.trim()).toBe('Body');
  });

  it('returns an error on malformed YAML without throwing', () => {
    const result = parseBlockFrontmatter(
      `---
id: [broken
---

Body`,
      '/project/blocks/broken.md',
      'blocks/broken.md'
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe('INVALID_FRONTMATTER');
  });

  it('returns an error on missing required id', () => {
    const result = parseBlockFrontmatter(
      `---
tags: [auth]
---

Body`,
      '/project/blocks/missing.md',
      'blocks/missing.md'
    );

    expect(result.data.id).toBe('');
    expect(result.errors[0]?.code).toBe('INVALID_FRONTMATTER');
  });

  it('parses scoped dependency syntax', () => {
    expect(parseDependencyRef('block-id#section.tag')).toEqual({
      blockId: 'block-id',
      section: 'section',
      tag: 'tag',
      raw: 'block-id#section.tag'
    });
  });
});

describe('parseViewFrontmatter', () => {
  it('extracts view id and group', () => {
    const result = parseViewFrontmatter(
      `---
id: auth-service-view
group: by-audience/backend
---

Body`,
      '/project/views/auth.md',
      'views/auth.md'
    );

    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({
      id: 'auth-service-view',
      group: 'by-audience/backend'
    });
  });
});
