import { describe, expect, it } from 'vitest';

import type { ParsedBlock, Position, StemSection, StemTag, TagSchema } from '../../src/core/types/index.js';
import { validateSchemas } from '../../src/core/validator/schema.js';

describe('validateSchemas', () => {
  it('returns an empty array when schemas map is empty', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('api', 'missing content')] })]
    });

    expect(validateSchemas([block], new Map())).toEqual([]);
  });

  it('returns an empty array when no tags match any schema', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('summary', 'anything')] })]
    });

    expect(validateSchemas([block], createSchemas([createSchema('api', ['endpoint'])]))).toEqual([]);
  });

  it('returns an empty array when all required sections are present in tag content', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('api', 'endpoint request response')] })]
    });

    expect(validateSchemas([block], createSchemas([createSchema('api', ['endpoint', 'response'])]))).toEqual([]);
  });

  it('emits SCHEMA_VIOLATION when a required section is missing from tag content', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('api', 'endpoint only')] })]
    });

    const issues = validateSchemas([block], createSchemas([createSchema('api', ['endpoint', 'response'])]));

    expect(issues[0]).toMatchObject({
      code: 'SCHEMA_VIOLATION',
      severity: 'error',
      filePath: '/project/blocks/auth-block.md',
      relativePath: 'blocks/auth-block.md',
      context: { tagName: 'api', missingSections: 'response' }
    });
  });

  it('reports all missing required sections in the context', () => {
    const block = createBlock('auth-block', {
      sections: [createSection('auth-flow', { tags: [createTag('api', 'endpoint only')] })]
    });

    const issues = validateSchemas(
      [block],
      createSchemas([createSchema('api', ['endpoint', 'request', 'response'])])
    );

    expect(issues[0]?.context).toEqual({ tagName: 'api', missingSections: 'request, response' });
  });

  it('handles multiple blocks with multiple schema violations', () => {
    const blocks = [
      createBlock('auth-block', {
        sections: [createSection('auth-flow', { tags: [createTag('api', 'endpoint')] })]
      }),
      createBlock('billing-block', {
        sections: [createSection('billing-flow', { tags: [createTag('api', 'request')] })]
      })
    ];

    const issues = validateSchemas(blocks, createSchemas([createSchema('api', ['endpoint', 'request'])]));

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.relativePath)).toEqual(['blocks/auth-block.md', 'blocks/billing-block.md']);
  });

  it('checks standalone tags as well as section tags', () => {
    const block = createBlock('auth-block', {
      standaloneTags: [createTag('api', 'endpoint')]
    });

    const issues = validateSchemas([block], createSchemas([createSchema('api', ['endpoint', 'response'])]));

    expect(issues[0]).toMatchObject({
      code: 'SCHEMA_VIOLATION',
      context: { tagName: 'api', missingSections: 'response' }
    });
  });

  it('does not emit for tags with no matching schema', () => {
    const block = createBlock('auth-block', {
      standaloneTags: [createTag('summary', '')]
    });

    expect(validateSchemas([block], createSchemas([createSchema('api', ['endpoint'])]))).toEqual([]);
  });

  it('sets severity to error for schema violations', () => {
    const block = createBlock('auth-block', {
      standaloneTags: [createTag('api', '')]
    });

    const issues = validateSchemas([block], createSchemas([createSchema('api', ['endpoint'])]));

    expect(issues[0]?.severity).toBe('error');
  });
});

const POSITION: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 2 }
};

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

function createTag(name: string, content: string): StemTag {
  return {
    name,
    section: null,
    content,
    contentRange: { startOffset: 0, endOffset: content.length },
    position: POSITION
  };
}

function createSchema(name: string, required: string[]): TagSchema {
  return {
    name,
    required
  };
}

function createSchemas(schemas: TagSchema[]): Map<string, TagSchema> {
  return new Map(schemas.map((schema) => [schema.name, schema]));
}
