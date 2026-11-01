import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mockApi, openDocument, fileUri, previewUri, stem, writeProjectFile } from './helpers.js';
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
it('uses unsaved source and config inputs without saving them', async () => {
  const { api, documents } = mockApi();
  documents.push(
    openDocument(path.join(root, 'blocks/a.md'), () => '@stem:block(id:a) unsaved @stem:end()')
  );
  documents.push(
    openDocument(path.join(root, '.stem/config.json'), () =>
      JSON.stringify({ projectId, outputSets: {} })
    )
  );
  expect(await stem.renderPreview(previewUri(root), api)).toMatchObject({
    content: 'before unsaved after',
    complete: true,
    diagnostics: []
  });
  expect(await fs.readFile(path.join(root, 'blocks/a.md'), 'utf8')).toContain(' disk ');
  expect(await fs.readdir(path.join(root, '.stem'))).toEqual(['config.json']);
});
it('preserves ordinary frontmatter and partial content; reports diagnostics separately', async () => {
  await writeProjectFile(
    root,
    'blocks/api.md',
    '---\nid: [ordinary\n---\npre@stem:include(missing)post'
  );
  const { api } = mockApi();
  const result = await stem.renderPreview(previewUri(root), api);
  expect(result.content).toBe('---\nid: [ordinary\n---\nprepost');
  expect(result.complete).toBe(false);
  expect(result.diagnostics.length).toBeGreaterThan(0);
});
it('allows unsaved identity correction but never repairs disk configuration', async () => {
  await writeProjectFile(root, '.stem/config.json', '{}');
  const { api, documents } = mockApi();
  await expect(stem.renderPreview(previewUri(root), api)).rejects.toThrow('projectId');
  documents.push(
    openDocument(path.join(root, '.stem/config.json'), () => JSON.stringify({ projectId }))
  );
  expect((await stem.renderPreview(previewUri(root), api)).complete).toBe(true);
  expect(await fs.readFile(path.join(root, '.stem/config.json'), 'utf8')).toBe('{}');
});
it('rejects unknown unsaved configuration before source loading', async () => {
  const { api, documents, raw } = mockApi();
  documents.push(
    openDocument(path.join(root, '.stem/config.json'), () =>
      JSON.stringify({ projectId, viewsDir: 'views' })
    )
  );
  await expect(stem.renderPreview(previewUri(root), api)).rejects.toThrow('Unknown');
  expect(raw.workspace.fs.readDirectory).not.toHaveBeenCalled();
});
it('includes a new unsaved source buffer within the source boundary', async () => {
  const { api, documents } = mockApi();
  documents.push(openDocument(path.join(root, 'blocks/new.md'), () => 'unsaved file'));
  expect(
    await stem.renderProjectPreview(api, fileUri(root), fileUri(path.join(root, 'blocks/new.md')))
  ).toMatchObject({ content: 'unsaved file', complete: true });
});
it('rejects outdated overlapping work without substituting cached content', async () => {
  const { api, raw, documents } = mockApi();
  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((r) => (release = r));
  const begun = new Promise<void>((r) => (started = r));
  const read = raw.workspace.fs.readFile.getMockImplementation()!;
  raw.workspace.fs.readFile.mockImplementation(async (target) => {
    if (target.fsPath.endsWith('a.md')) {
      started();
      await pending;
    }
    return read(target);
  });
  const provider = new stem.StemPreviewProvider(
    {},
    {
      ...api,
      window: raw.window,
      EventEmitter: class {
        event = () => ({ dispose() {} });
        fire() {}
        dispose() {}
      }
    }
  );
  const target = previewUri(root);
  provider.track(target);
  const first = provider.provideTextDocumentContent(target);
  const rejected = expect(first).rejects.toThrow();
  await begun;
  documents.push(
    openDocument(path.join(root, 'blocks/a.md'), () => '@stem:block(id:a) latest @stem:end()')
  );
  const second = provider.provideTextDocumentContent(target);
  expect(await second).toBe('before latest after');
  release();
  await rejected;
  provider.cancelProject(root);
  expect(await provider.provideTextDocumentContent(target)).toBe('');
  provider.refreshProject(root);
  expect(await provider.provideTextDocumentContent(target)).toBe('before latest after');
  provider.untrack(target);
});
it('invalidates immediately with auto-refresh off', () => {
  const provider = {
    getTrackedProjects: () => [root],
    hasProject: () => true,
    cancelProject: vi.fn(),
    refreshProject: vi.fn()
  };
  const watchers = new stem.StemPreviewWatcherManager(provider, {
    isAutoRefreshEnabled: () => false,
    getRefreshDebounceMs: () => 250
  });
  watchers.documentChanged(openDocument(path.join(root, 'blocks/a.md'), () => ''));
  expect(provider.cancelProject).toHaveBeenCalledExactlyOnceWith(root);
  expect(provider.refreshProject).not.toHaveBeenCalled();
  watchers.dispose();
});
it('retains decoder envelope/timestamp policy while metadata cannot supply bodies', async () => {
  await writeProjectFile(
    root,
    '.stem/config.json',
    JSON.stringify({ projectId, namespaces: { lib: { graphUrl: 'unused' } } })
  );
  await writeProjectFile(
    root,
    '.stem/cache/namespaces/lib.json',
    JSON.stringify({
      fetchedAt: 'not a date',
      graph: {
        version: '2',
        projectId,
        namespace: 'lib',
        publishedAt: '',
        contentSha: '',
        blocks: [{ id: 'x', tags: [] }],
        renames: []
      }
    })
  );
  await writeProjectFile(root, 'blocks/api.md', 'pre@stem:include(lib:x)post');
  const { api } = mockApi();
  const loaded = await stem.loadProjectSnapshot(api, fileUri(root));
  expect(loaded.externalGraphs.get('lib')?.fetchedAt).toBe('not a date');
  expect(await stem.renderPreview(previewUri(root), api)).toMatchObject({
    content: 'prepost',
    complete: false
  });
});

it('includes new unsaved inputs under a configured hidden source root', async () => {
  await writeProjectFile(
    root,
    '.stem/config.json',
    JSON.stringify({ projectId, blocksDir: '.sources' })
  );
  const { api, documents } = mockApi();
  documents.push(openDocument(path.join(root, '.sources/new.md'), () => 'new source'));
  expect(
    await stem.renderProjectPreview(api, fileUri(root), fileUri(path.join(root, '.sources/new.md')))
  ).toMatchObject({ content: 'new source', complete: true });
});

it.each(['api', 'workspace', 'document'] as const)(
  'does not evaluate unrelated %s getters while capturing unsaved input',
  async (surface) => {
    const { api, documents } = mockApi();
    const document = openDocument(
      path.join(root, 'blocks/a.md'),
      () => '@stem:block(id:a) unsaved @stem:end()'
    );
    documents.push(document);
    const guarded = vi.fn(() => {
      throw new Error("Extension 'stemdev.vscode-stem' CANNOT use API proposal: tunnels.");
    });
    const target = surface === 'api' ? api : surface === 'workspace' ? api.workspace : document;
    Object.defineProperty(target, surface === 'workspace' ? 'tunnels' : 'unrelated', {
      enumerable: true,
      get: guarded
    });
    expect(await stem.renderPreview(previewUri(root), api)).toMatchObject({
      content: 'before unsaved after',
      complete: true
    });
    expect(guarded).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(root, 'blocks/a.md'), 'utf8')).toContain(' disk ');
  }
);
