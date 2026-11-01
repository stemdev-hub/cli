import { expect, it } from 'vitest';
import * as core from '../../src/index.js';
it('exports the exact-source parser without legacy entry points', () => {
  for (const name of ['parseBlockFile', 'parseViewFile', 'parseFrontmatter', 'renderViewMarkdown'])
    expect(core).not.toHaveProperty(name);
  const content =
    '\uFEFF---\r\nid: ordinary\r\n---\r\n@stem:block(id:child) body @stem:end(id:child)';
  const result = core.parse({ sourceId: 'unsaved:doc', content });
  expect(result.tree.source.content).toBe(content);
  expect(result.tree.children.filter((n) => n.kind === 'block')).toHaveLength(1);
  expect(result.tree.children[0]).toMatchObject({
    kind: 'text',
    value: content.slice(0, content.indexOf('@stem:block'))
  });
  expect(result.diagnostics).toEqual([]);
});
it.each(['A_1', 'under_score', 'a-b'])('uses the shared ID/reference grammar: %s', (id) => {
  expect(core.isBlockId(id)).toBe(true);
  expect(core.parseBlockReference('lib:' + id)).toEqual({ qualifier: 'lib', id });
});
it.each(['', 'white space', 'a.b', 'a\n', 'a:section', ' a'])(
  'rejects invalid local IDs: %j',
  (id) => expect(core.isBlockId(id)).toBe(false)
);
