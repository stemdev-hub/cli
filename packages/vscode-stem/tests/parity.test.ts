import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fileUri, mockApi, previewUri, stem, writeProjectFile } from './helpers.js';
let root: string;
const projectId = '0f671f2d-657d-4f3c-9a7d-d22f769c083a';
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'stem-editor-'));
  await writeProjectFile(root, '.stem/config.json', JSON.stringify({ projectId }));
  await writeProjectFile(root, 'blocks/api.md', 'before@stem:include(a)after');
  await writeProjectFile(root, 'blocks/a.md', '@stem:block(id:a) disk @stem:end()');
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
it.each([
  'before@stem:include(a)after',
  '---\nid: text\n---\n  Exact \r\n bytes  ',
  'pre@stem:include(missing)post'
])('matches built CLI exact content: %s', async (content) => {
  await writeProjectFile(root, 'blocks/api.md', content);
  const { api } = mockApi();
  const editor = await stem.renderPreview(previewUri(root), api);
  let stdout: string;
  try {
    stdout = (
      await run(
        process.execPath,
        [
          path.resolve(import.meta.dirname, '../../cli/dist/cli/index.js'),
          'preview',
          'file',
          'blocks/api.md'
        ],
        { cwd: root }
      )
    ).stdout;
  } catch (error) {
    stdout = (error as { stdout: string }).stdout;
  }
  expect(stdout).toBe(editor.content);
});
it('shares resource defaults with the extension settings', async () => {
  const { DEFAULT_COMPOSITION_LIMITS } = await import('@stemdev/core');
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(import.meta.dirname, '../package.json'), 'utf8')
  ) as { contributes: { configuration: { properties: Record<string, { default: unknown }> } } };
  expect(manifest.contributes.configuration.properties['stem.preview.maxWork']?.default).toBe(
    DEFAULT_COMPOSITION_LIMITS.maxWork
  );
  expect(
    manifest.contributes.configuration.properties['stem.preview.maxOutputBytes']?.default
  ).toBe(DEFAULT_COMPOSITION_LIMITS.maxOutputBytes);
});

async function discoveryParity(): Promise<string[]> {
  const { snapshot } = await stem.loadProjectSnapshot(mockApi().api, fileUri(root));
  const sources = snapshot.instances[0]!.sources!.map((source) => source.sourceId);
  const { stdout } = await run(
    process.execPath,
    [path.resolve(import.meta.dirname, '../../cli/dist/cli/index.js'), 'list', 'blocks', '--json'],
    { cwd: root }
  );
  const result = JSON.parse(stdout) as {
    success: boolean;
    data: { blocks: { sourceId: string }[] };
  };
  expect(result.success).toBe(true);
  expect(result.data.blocks.map((block) => block.sourceId)).toEqual(sources);
  return sources;
}
it.each([
  '.hidden/child.md',
  '.secret.md',
  '.git/child.md',
  'node_modules/child.md',
  'dist/child.md',
  '.stem/cache/child.md',
  'upper.MD',
  'other.txt'
])('keeps CLI/editor discovery aligned for excluded %s', async (file) => {
  await writeProjectFile(root, 'blocks/api.md', '@stem:block(id:page)P@stem:end()');
  await writeProjectFile(root, 'blocks/' + file, '@stem:block(id:excluded)X@stem:end()');
  expect(await discoveryParity()).toEqual(['blocks/a.md', 'blocks/api.md']);
});
it('shares recursive ordering, gitignore and former schema-directory semantics', async () => {
  await writeProjectFile(root, 'blocks/api.md', '@stem:block(id:page)P@stem:end()');
  await writeProjectFile(root, '.gitignore', 'blocks/nested/\nblocks/schemas/\n');
  for (const [index, file] of ['z.md', 'Alpha.md', 'nested/b.md', 'schemas/ordinary.md'].entries())
    await writeProjectFile(root, 'blocks/' + file, '@stem:block(id:item' + index + ')X@stem:end()');
  await writeProjectFile(root, 'blocks/schemas/rules.yaml', 'bad yaml: [');
  const sources = await discoveryParity();
  expect(sources).toHaveLength(6);
  expect(sources).toEqual([...sources].sort((a, b) => a.localeCompare(b)));
});
it('normalizes configured Windows separators in both callers', async () => {
  await writeProjectFile(
    root,
    '.stem/config.json',
    JSON.stringify({ projectId, blocksDir: 'custom\\blocks' })
  );
  await writeProjectFile(root, 'custom/blocks/doc.md', '@stem:block(id:doc)D@stem:end()');
  expect(await discoveryParity()).toEqual(['custom/blocks/doc.md']);
});
it('preserves source aliases inside blocksDir instead of silently deduplicating them', async () => {
  await writeProjectFile(root, 'blocks/api.md', '@stem:block(id:page)P@stem:end()');
  await writeProjectFile(root, 'blocks/nested/source.md', 'ordinary');
  await fs.symlink(path.join(root, 'blocks/nested'), path.join(root, 'blocks/alias'), 'junction');
  try {
    const { snapshot } = await stem.loadProjectSnapshot(mockApi().api, fileUri(root));
    expect(snapshot.instances[0]!.sources!.map((source) => source.sourceId)).toEqual(
      ['blocks/a.md', 'blocks/alias/source.md', 'blocks/api.md', 'blocks/nested/source.md'].sort(
        (a, b) => a.localeCompare(b)
      )
    );
  } finally {
    await fs.unlink(path.join(root, 'blocks/alias'));
  }
});
it('rejects a directory link outside blocksDir in both callers', async () => {
  await writeProjectFile(root, 'outside/source.md', '@stem:block(id:outside)X@stem:end()');
  await fs.symlink(path.join(root, 'outside'), path.join(root, 'blocks/alias'), 'junction');
  try {
    await expect(stem.loadProjectSnapshot(mockApi().api, fileUri(root))).rejects.toThrow(
      'blocksDir'
    );
    await expect(
      run(
        process.execPath,
        [
          path.resolve(import.meta.dirname, '../../cli/dist/cli/index.js'),
          'list',
          'blocks',
          '--json'
        ],
        { cwd: root }
      )
    ).rejects.toMatchObject({ code: 1 });
  } finally {
    await fs.unlink(path.join(root, 'blocks/alias'));
  }
});
