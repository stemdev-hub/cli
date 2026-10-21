import assert from 'node:assert/strict';
import test from 'node:test';
import { markdownInfo, existingPaths, checkLocalLinks, checkDecisionMetadata, checkLabelOwners, sameGenerated } from './check-docs.mjs';

test('headings use GitHub duplicate/Unicode slugs; fenced examples are not links/headings', () => {
  const fence = String.fromCharCode(96).repeat(3);
  const info = markdownInfo('# Héllo 世界\n\n# Héllo 世界\n\n' + fence + 'md\n# Fake\n[x](missing.md)\n' + fence + '\n\n<a id="old-route"></a>\n');
  assert.deepEqual([...info.anchors], ['héllo-世界', 'héllo-世界-1', 'old-route']);
  assert.deepEqual(info.links, []);
});

test('relative, reference-style and repository URLs resolve to owned files and anchors', () => {
  const docs = new Map([
    ['README.md', '[one](docs/a.md#hello)\n[two][ref]\n\n[ref]: docs/a.md#hello-1\n\n[three](https://github.com/stemdev-hub/cli/blob/main/docs/a.md#hello)\n'],
    ['docs/a.md', '# Hello\n\n# Hello\n\n[back](../README.md)\n']
  ]);
  assert.deepEqual(checkLocalLinks(docs).errors, []);
});

test('missing targets and anchors fail with source locations; paths are case-sensitive', () => {
  const docs = new Map([['README.md', '[x](missing.md)\n[y](docs/a.md#absent)\n[z](Docs/a.md)\n'], ['docs/a.md', '# Exists']]);
  const result = checkLocalLinks(docs);
  assert.equal(result.errors.length, 3);
  assert.ok(result.errors.some(e => e.includes('README.md:2: missing anchor')));
});

test('encoded paths and explicit anchors work; external URLs are not fetched', () => {
  const docs = new Map([['README.md', '[x](docs/a%20b.md#old)\n[x](https://example.com/missing)\n'], ['docs/a b.md', '<a name="old"></a>']]);
  assert.deepEqual(checkLocalLinks(docs).errors, []);
  assert.equal(checkLocalLinks(docs).checked, 1);
  assert.ok(existingPaths(['docs/a b.md']).has('docs'));
});

test('fixture links are excluded from navigation checks but fixture paths remain valid targets', () => {
  const docs = new Map([['README.md', '[fixture](packages/cli/spike/test-input.md)'], ['packages/cli/spike/test-input.md', '[intentional](absent.md)']]);
  assert.deepEqual(checkLocalLinks(docs).errors, []);
});

test('partial supersession must point to a linked record with accepted history', () => {
  const docs = new Map([
    ['docs/decisions/0001-first.md', 'Status: accepted; clause superseded by [ADR-0002](./0002-next.md)\n'],
    ['docs/decisions/0002-next.md', 'Status: proposed\n']
  ]);
  assert.ok(checkDecisionMetadata(docs).some(e => e.includes('no accepted history')));
  docs.set('docs/decisions/0002-next.md', 'Status: accepted\n');
  assert.deepEqual(checkDecisionMetadata(docs), []);
});

test('a historical supersession chain is valid, but a cycle is not', () => {
  const docs = new Map([
    ['docs/decisions/0001-a.md', 'Status: superseded by [ADR-0002](0002-b.md)\n'],
    ['docs/decisions/0002-b.md', 'Status: superseded by [ADR-0003](0003-c.md)\n'],
    ['docs/decisions/0003-c.md', 'Status: accepted\n']
  ]);
  assert.deepEqual(checkDecisionMetadata(docs), []);
  docs.set('docs/decisions/0003-c.md', 'Status: accepted; scope superseded by [ADR-0001](0001-a.md)\n');
  assert.ok(checkDecisionMetadata(docs).some(e => e.includes('supersession cycle')));
});

test('accepted specifications cannot silently depend on proposed decisions', () => {
  const docs = new Map([
    ['docs/decisions/0001-a.md', 'Status: proposed\n'],
    ['docs/specs/a.md', 'Status: accepted. Governing decision:\n[ADR-0001](../decisions/0001-a.md)\n\n## Contract\n']
  ]);
  assert.ok(checkDecisionMetadata(docs).some(e => e.includes('unaccepted ADR')));
  docs.set('docs/specs/a.md', 'Status: proposed. Governing decision:\n[ADR-0001](../decisions/0001-a.md)\n');
  assert.deepEqual(checkDecisionMetadata(docs), []);
});

test('decision identifiers are unique; template placeholders are not records', () => {
  const docs = new Map([
    ['docs/decisions/0000-template.md', 'Status: proposed | accepted\n'],
    ['docs/decisions/0001-a.md', 'Status: accepted\n'],
    ['docs/decisions/0001-b.md', 'Status: rejected\n']
  ]);
  assert.ok(checkDecisionMetadata(docs).some(e => e.includes('duplicate decision identifier')));
});

test('history or planning labels cannot replace their canonical specification', () => {
  const docs = new Map([
    ['roadmap.md', '## D23. Planning\n'],
    ['docs/history/a.md', '## D23. Old contract\n'],
    ['docs/specs/block-model.md', '# Model\n']
  ]);
  const owners = new Map([['docs/specs/block-model.md', ['D23']]]);
  assert.equal(checkLabelOwners(docs, owners).length, 1);
  docs.set('docs/specs/block-model.md', '## D23. Transition\n');
  assert.deepEqual(checkLabelOwners(docs, owners), []);
});

test('generated comparison tolerates CRLF only, not signature or whitespace changes', () => {
  assert.ok(sameGenerated('export type X = string;\r\n', 'export type X = string;\n'));
  assert.ok(!sameGenerated('export type X = string;\n', 'export type X = number;\n'));
  assert.ok(!sameGenerated('export type X = string;\n', 'export type X = string;'));
});
