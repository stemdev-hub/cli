import { describe, expect, it } from 'vitest';
import { remark } from 'remark';
import { parseBlockFile, parseViewFile } from '../../src/core/parser/index.js';
import { renderViewMarkdown } from '../../src/core/renderer/index.js';

describe('renderViewMarkdown', () => {
  it('renders a whole block without Stem control macros', () => {
    const block = parseBlock(`---
id: auth
---
Intro.

@stem[section:summary]
Section prose.
@stem[end]
`);
    const view = parseView(`---
id: api-view
---
# API

@stem[block:auth]
`);

    expect(renderOk(view, [block])).toBe(`# API

Intro.

Section prose.
`);
  });

  it('renders a filtered section', () => {
    const block = parseBlock(`---
id: auth
---
@stem[section:summary]
Section prose.
@stem[end]
`);
    const view = parseView(`---
id: api-view
---
@stem[block:auth section=summary]
`);

    expect(renderOk(view, [block])).toBe('Section prose.\n');
  });

  it('renders a filtered section tag', () => {
    const block = parseBlock(`---
id: auth
---
@stem[section:summary]
@stem[tag:api]
Endpoint summary.
@stem[end]
@stem[end]
`);
    const view = parseView(`---
id: api-view
---
@stem[block:auth section=summary tag=api]
`);

    expect(renderOk(view, [block])).toBe('Endpoint summary.\n');
  });

  it('concatenates duplicate filtered tags in document order', () => {
    const block = parseBlock(`---
id: auth
---
@stem[section:summary]
@stem[tag:api]
First summary.
@stem[end]
@stem[tag:api]
Second summary.
@stem[end]
@stem[end]
`);
    const view = parseView(`---
id: api-view
---
@stem[block:auth section=summary tag=api]
`);

    expect(renderOk(view, [block])).toBe(`First summary.
Second summary.
`);
  });

  it('preserves local Markdown and code examples', () => {
    const block = parseBlock(`---
id: auth
---
Auth content.
`);
    const view = parseView(`---
id: api-view
---
Before.

@stem[block:auth]

\`\`\`md
@stem[block:auth]
\`\`\`
`);

    expect(renderOk(view, [block])).toBe(`Before.

Auth content.

\`\`\`md
@stem[block:auth]
\`\`\`
`);
  });

  it('renders multiple references in source order', () => {
    const first = parseBlock(`---
id: first
---
First.
`);
    const second = parseBlock(`---
id: second
---
Second.
`);
    const view = parseView(`---
id: api-view
---
@stem[block:first]
Then
@stem[block:second]
`);

    expect(renderOk(view, [first, second])).toBe(`First.
Then
Second.
`);
  });

  it('substitutes parameter values through the AST path', () => {
    const block = parseBlock(`---
id: db
---
Run docker on port {{port}} for {{db_name}}.
`);
    const view = parseView(`---
id: api-view
---
@stem[block:db, db_name="PostgreSQL", port="5432"]
`);

    expect(renderOk(view, [block])).toBe('Run docker on port 5432 for PostgreSQL.');
  });

  it('keeps supplied placeholder-like values single-pass', () => {
    const block = parseBlock(`---
id: db
---
Use {{first}} and {{second}}.
`);
    const view = parseView(`---
id: api-view
---
@stem[block:db, first="{{second}}", second="ready"]
`);

    expect(renderOk(view, [block])).toBe('Use {{second}} and ready.');
  });

  it('treats empty values as provided and ignores unused parameters', () => {
    const block = parseBlock(`---
id: db
---
Port: "{{port}}".
`);
    const view = parseView(`---
id: api-view
---
@stem[block:db, port="", unused="ignored"]
`);

    expect(renderOk(view, [block])).toBe('Port: "".');
  });

  it('leaves escaped placeholders literal', () => {
    const block = parseBlock(`---
id: db
---
Literal \\{{port}} and real {{port}}.
`);
    const view = parseView(`---
id: api-view
---
@stem[block:db, port="5432"]
`);

    expect(renderOk(view, [block])).toBe('Literal {{port}} and real 5432.');
  });

  it('substitutes values inside inline code and fenced code nodes', () => {
    const block = parseBlock(`---
id: db
---
Run \`docker -p {{port}}\`.

\`\`\`sh
docker run -p {{port}}:5432
\`\`\`
`);
    const view = parseView(`---
id: api-view
---
@stem[block:db, port="15432"]
`);

    expect(renderOk(view, [block])).toBe(`Run \`docker -p 15432\`.

\`\`\`sh
docker run -p 15432:5432
\`\`\``);
  });

  it('substitutes values inside headings, emphasis, and links in included blocks', () => {
    const block = parseBlock(`---
id: guide
---
# {{title}}

Use **{{feature}}** in [{{label}}](/docs/setup).
`);
    const view = parseView(`---
id: api-view
---
@stem[block:guide, title="API", feature="Stem", label="docs"]
`);

    expect(renderOk(view, [block])).toBe(`# API

Use **Stem** in [docs](/docs/setup).`);
  });

  it('serializes special-character values as literal text', () => {
    const block = parseBlock(`---
id: guide
---
Name: {{name}}.
`);
    const view = parseView(`---
id: api-view
---
@stem[block:guide, name="**bold** [x](y) <tag>"]
`);

    expect(renderOk(view, [block])).toBe('Name: \\*\\*bold\\*\\* \\[x]\\(y) \\<tag>.');
  });

  it('allows surrounding whitespace when the macro is the only content in a paragraph', () => {
    const block = parseBlock(`---
id: auth
---
Auth content.
`);
    const view = parseView(`---
id: api-view
---
 @stem[block:auth, unused="ignored"] 
`);

    expect(renderOk(view, [block])).toBe('Auth content.');
  });

  it('renders mixed legacy and extended references through one AST pass', () => {
    const auth = parseBlock(`---
id: auth
---
Auth content.
`);
    const db = parseBlock(`---
id: db
---
DB: {{db_name}}.
`);
    const view = parseView(`---
id: api-view
---
@stem[block:auth]

@stem[block:db, db_name="PostgreSQL"]
`);

    expect(renderOk(view, [auth, db])).toBe(`Auth content.

DB: PostgreSQL.`);
  });

  it('renders the same parameterized view deterministically', () => {
    const block = parseBlock(`---
id: db
---
DB: {{db_name}}.
`);
    const view = parseView(`---
id: api-view
---
@stem[block:db, db_name="PostgreSQL"]
`);

    expect(renderOk(view, [block])).toBe(renderOk(view, [block]));
  });

  it('scopes missing variables per referencing view', () => {
    const block = parseBlock(`---
id: db
---
DB: {{db_name}}.
`);
    const complete = parseView(`---
id: complete-view
---
@stem[block:db, db_name="PostgreSQL"]
`);
    const incomplete = parseView(`---
id: incomplete-view
---
@stem[block:db, unused="ignored"]
`);

    expect(renderOk(complete, [block])).toBe('DB: PostgreSQL.');
    const result = renderViewMarkdown(incomplete, [block]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validation.issues).toMatchObject([
        {
          code: 'MISSING_BLOCK_VARIABLE',
          context: { viewPath: 'views/view.md', variableName: 'db_name' }
        }
      ]);
    }
  });

  it('collects structural, unresolved, and missing-variable render diagnostics together', () => {
    const block = parseBlock(`---
id: auth
---
Auth {{name}}.
`);
    const view = parseView(`---
id: api-view
---
Inline @stem[block:auth, unused="ignored"]

@stem[block:missing, unused="ignored"]
`);

    const result = renderViewMarkdown(view, [block]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validation.issues.map((issue) => issue.code).sort()).toEqual([
        'BROKEN_BLOCK_REF',
        'INLINE_BLOCK_REFERENCE',
        'MISSING_BLOCK_VARIABLE'
      ]);
    }
  });

  it('preserves multi-child fragments inside list items as loose list structure', () => {
    const block = parseBlock(`---
id: snippet
---
Intro.

\`\`\`ts
console.log("ok");
\`\`\`
`);
    const view = parseView(`---
id: api-view
---
- @stem[block:snippet, unused="ignored"]
`);

    const markdown = renderOk(view, [block]);
    const reparsed = remark().parse(markdown) as { children: Array<{ type: string; children?: unknown[] }> };
    const list = reparsed.children[0] as { children: Array<{ spread?: boolean; children: Array<{ type: string }> }> };
    const listItem = list.children[0];

    expect(listItem?.spread).toBe(true);
    expect(listItem?.children.map((node) => node.type)).toEqual(['paragraph', 'code']);
  });

  it('does not produce markdown when rendering fails', () => {
    const block = parseBlock(`---
id: auth
---
Auth {{name}}.
`);
    const view = parseView(`---
id: api-view
---
@stem[block:auth, unused="ignored"]
`);

    const result = renderViewMarkdown(view, [block]);

    expect(result.success).toBe(false);
    expect('markdown' in result).toBe(false);
  });
});

function renderOk(view: ReturnType<typeof parseView>, blocks: ReturnType<typeof parseBlock>[]): string {
  const result = renderViewMarkdown(view, blocks);
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(`Expected render to succeed, got ${result.validation.errorCount} errors.`);
  }
  return result.markdown;
}

function parseBlock(content: string) {
  return parseBlockFile({
    content,
    filePath: '/project/blocks/block.md',
    relativePath: 'blocks/block.md'
  });
}

function parseView(content: string) {
  return parseViewFile({
    content,
    filePath: '/project/views/view.md',
    relativePath: 'views/view.md'
  });
}
