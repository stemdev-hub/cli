import { expect, it } from 'vitest';
import {
  analyzeProject,
  planCreateBlock,
  planAddInclusion,
  planDeleteBlock,
  planRenameBlock
} from '../../src/index.js';
function analyze(content: string) {
  const local = {};
  return analyzeProject({
    localInstance: local,
    instances: [{ handle: local, sources: [{ sourceId: 'doc.md', content }] }]
  });
}

it('prepares root and child creation without replacing existing text', () => {
  const content = 'before\r\n@stem:block(id:p)P\r\n@stem:end(id:p)\r\nafter';
  const analysis = analyze(content);
  const child = planCreateBlock(analysis, 'c', { kind: 'block', id: 'p' }, [
    'é',
    'é',
    'quoted " tag'
  ]);
  expect(child.success).toBe(true);
  if (!child.success) return;
  expect(child.edits[0]!.range).toEqual({
    startOffset: content.indexOf('@stem:end'),
    endOffset: content.indexOf('@stem:end')
  });
  expect(child.edits[0]!.replacement).toContain('@stem:block(id:c tags:');
  expect(child.edits[0]!.replacement).toContain(JSON.stringify('é'));
  expect(child.edits[0]!.replacement).not.toContain(JSON.stringify('é'));
  const root = planCreateBlock(analysis, 'r', { kind: 'file', sourceId: 'doc.md' });
  expect(root.success && root.edits[0]!.range.startOffset).toBe(content.length);
});
it.each(['@stem:block(id:p)open', '@stem:block(id:p)@stem:block(id:c)@stem:end(id:p)'])(
  'rejects recovered insertion/deletion even with force',
  (content) => {
    const a = analyze(content);
    expect(planCreateBlock(a, 'x', { kind: 'file', sourceId: 'doc.md' }).success).toBe(false);
    expect(planDeleteBlock(a, 'p', true).success).toBe(false);
  }
);
it('deletes an exact subtree and detects references to descendants', () => {
  const a = analyze(
    'surround@stem:block(id:p)@stem:block(id:c)C@stem:end()@stem:end()tail@stem:include(c)'
  );
  expect(planDeleteBlock(a, 'p').success).toBe(false);
  const forced = planDeleteBlock(a, 'p', true);
  expect(forced.success).toBe(true);
  if (!forced.success) return;
  expect(forced.references).toHaveLength(1);
  expect(forced.edits[0]!.replacement).toBe('');
  expect(forced.definitions.map((d) => d.id)).toEqual(['p', 'c']);
});
it('renames only recognized ID tokens and references', () => {
  const content =
    'a prose @stem:block(id:a)child @stem:block(id:c)C@stem:end(id:c)@stem:end(id:a) @stem:include(a)';
  const a = analyze(content);
  const plan = planRenameBlock(a, 'a', 'new');
  expect(plan.success).toBe(true);
  if (!plan.success) return;
  let result = content;
  for (const edit of [...plan.edits].sort((a, b) => b.range.startOffset - a.range.startOffset))
    result =
      result.slice(0, edit.range.startOffset) +
      edit.replacement +
      result.slice(edit.range.endOffset);
  expect(result).toBe(
    content
      .replace('id:a)', 'id:new)')
      .replace('end(id:a)', 'end(id:new)')
      .replace('include(a)', 'include(new)')
  );
  expect(planRenameBlock(a, 'a', 'a')).toMatchObject({ success: true, edits: [] });
  expect(planRenameBlock(a, 'a', 'c').success).toBe(false);
});
it('requires resolved inclusion targets and exhaustive safety for force', () => {
  const a = analyze('@stem:block(id:a)A@stem:end()@stem:include(missing)');
  expect(planAddInclusion(a, 'missing', { kind: 'file', sourceId: 'doc.md' }).success).toBe(false);
  expect(planDeleteBlock(a, 'a', true).success).toBe(false);
  expect(planRenameBlock(a, 'a', 'b').success).toBe(false);
});
