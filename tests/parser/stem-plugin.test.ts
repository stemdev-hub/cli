import { describe, expect, it } from 'vitest';
import { parseMarkdownBody } from '../../src/core/parser/index.js';
import { collectStemNodes } from '../../src/core/parser/stem-plugin.js';

describe('Stem remark plugin', () => {
  it('identifies block references', () => {
    const nodes = collectStemNodes(parseMarkdownBody('@stem[block:auth-flow-block]'));

    expect(nodes[0]).toMatchObject({
      type: 'stemBlockRef',
      blockId: 'auth-flow-block',
      section: null,
      tag: null,
      raw: '@stem[block:auth-flow-block]'
    });
  });

  it('identifies filtered block references', () => {
    const nodes = collectStemNodes(
      parseMarkdownBody('@stem[block:auth-flow-block section=auth-flow tag=summary]')
    );

    expect(nodes[0]).toMatchObject({
      type: 'stemBlockRef',
      blockId: 'auth-flow-block',
      section: 'auth-flow',
      tag: 'summary'
    });
  });

  it('identifies multiple references on the same line', () => {
    const nodes = collectStemNodes(parseMarkdownBody('@stem[block:first] and @stem[tag:second]'));

    expect(nodes.map((node) => node.type)).toEqual(['stemBlockRef', 'stemTag']);
    expect(nodes[0]).toMatchObject({ type: 'stemBlockRef', blockId: 'first' });
    expect(nodes[1]).toMatchObject({ type: 'stemTag', name: 'second' });
  });

  it('identifies sections and tags', () => {
    const nodes = collectStemNodes(
      parseMarkdownBody('@stem[section:auth-flow]\n@stem[tag:summary]\n@stem[end]\n@stem[end]')
    );

    expect(nodes.map((node) => node.type)).toEqual(['stemSection', 'stemTag', 'stemEnd', 'stemEnd']);
    expect(nodes[0]).toMatchObject({ type: 'stemSection', name: 'auth-flow' });
    expect(nodes[1]).toMatchObject({ type: 'stemTag', name: 'summary', section: null });
  });

  it('identifies external tag declarations', () => {
    const nodes = collectStemNodes(parseMarkdownBody('@stem[tag:summary section=auth-flow]'));

    expect(nodes[0]).toMatchObject({
      type: 'stemTag',
      name: 'summary',
      section: 'auth-flow'
    });
  });

  it('identifies dependencies', () => {
    const nodes = collectStemNodes(parseMarkdownBody('@stem[dep:block-id]\n@stem[dep:block-id#section.tag]'));

    expect(nodes[0]).toMatchObject({
      type: 'stemDep',
      blockId: 'block-id',
      section: null,
      tag: null
    });
    expect(nodes[1]).toMatchObject({
      type: 'stemDep',
      blockId: 'block-id',
      section: 'section',
      tag: 'tag'
    });
  });

  it('ignores Stem syntax inside fenced code blocks', () => {
    const nodes = collectStemNodes(
      parseMarkdownBody(`\`\`\`md
@stem[block:ignored]
\`\`\`

@stem[block:included]`)
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'stemBlockRef', blockId: 'included' });
  });

  it('ignores Stem syntax inside inline code spans', () => {
    const nodes = collectStemNodes(parseMarkdownBody('Ignore `@stem[block:ignored]` and parse @stem[block:included].'));

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'stemBlockRef', blockId: 'included' });
  });

  it('produces positions on Stem AST nodes', () => {
    const nodes = collectStemNodes(parseMarkdownBody('x @stem[block:id]'));

    expect(nodes[0]?.position?.start.column).toBe(3);
    expect(nodes[0]?.position?.end.column).toBe(18);
  });

  it('ignores unsupported directive types', () => {
    const nodes = collectStemNodes(parseMarkdownBody('@stem[unknown:id] @stem[block:included]'));

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'stemBlockRef', blockId: 'included' });
  });

  it('does not match directives spanning lines', () => {
    const nodes = collectStemNodes(
      parseMarkdownBody(`@stem[block:ignored
section=auth-flow]

@stem[block:included]`)
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'stemBlockRef', blockId: 'included' });
  });
});
