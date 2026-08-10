import { describe, expect, it } from 'vitest';
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

    expect(renderViewMarkdown(view, [block])).toBe(`# API

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

    expect(renderViewMarkdown(view, [block])).toBe('Section prose.\n');
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

    expect(renderViewMarkdown(view, [block])).toBe('Endpoint summary.\n');
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

    expect(renderViewMarkdown(view, [block])).toBe(`First summary.
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

    expect(renderViewMarkdown(view, [block])).toBe(`Before.

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

    expect(renderViewMarkdown(view, [first, second])).toBe(`First.
Then
Second.
`);
  });
});

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
