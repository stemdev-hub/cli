import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { fileUri, mockApi, openDocument, previewUri, stem, uri, vscodeMock, writeProjectFile } from './helpers.js';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'stem-preview-core-'));
  await mkdir(path.join(root, '.stem'));
  await writeProjectFile(root, 'blocks/auth.md', '---\nid: auth\n---\nDisk.');
  await writeProjectFile(root, 'views/api.md', '---\nid: api\n---\n@stem[block:auth]');
});
afterEach(async () => { vi.useRealTimers(); await rm(root, { recursive: true, force: true }); });

describe('built extension preview', () => {
  it('loads the vscode test module without resolving the real module', () => {
    expect(vscodeMock.__stemTestMock).toBe(true);
  });

  it('prefers unsaved blocks and views over disk', async () => {
    const { api, documents, raw } = mockApi();
    documents.push(openDocument(path.join(root, 'blocks/auth.md'), () => '---\nid: auth\n---\nUnsaved.'));
    documents.push(openDocument(path.join(root, 'views/api.md'), () => '---\nid: api\n---\n# Unsaved view\n\n@stem[block:auth]'));
    expect(await stem.renderProjectPreview(api, fileUri(root), 'api')).toBe('# Unsaved view\n\nUnsaved.\n');
    expect(raw.workspace.fs.readFile.mock.calls.map(([target]) => target.fsPath)).not.toContain(path.join(root, 'blocks/auth.md'));
    expect(raw.workspace.fs.readFile.mock.calls.map(([target]) => target.fsPath)).not.toContain(path.join(root, 'views/api.md'));
  });

  it('prefers open config and schemas and preserves duplicate-name overwrite', async () => {
    await writeProjectFile(root, '.stem/config.json', '{}');
    await writeProjectFile(root, 'custom/schemas/a.yaml', 'invalid');
    await writeProjectFile(root, 'custom/schemas/z.yml', 'name: api\nrequired: [last]');
    const { api, documents } = mockApi();
    documents.push(openDocument(path.join(root, '.stem/config.json'), () => '{"schemasDir":"custom/schemas"}'));
    documents.push(openDocument(path.join(root, 'custom/schemas/a.yaml'), () => 'name: api\nrequired: [first]'));
    const loaded = await stem.loadProjectSnapshot(api, fileUri(root));
    expect([...loaded.snapshot.schemas.values()]).toEqual([{ name: 'api', required: ['last'] }]);
  });

  it('rejects a non-file project or source before reading', async () => {
    const { api, raw } = mockApi();
    await expect(stem.loadProjectSnapshot(api, uri('vscode-remote://host/project'))).rejects.toThrow('on disk');
    const target = uri(stem.createPreviewUriText(root, 'api', 'untitled:api.md'));
    expect(await stem.renderPreview(target, api)).toContain('Stem preview is available for Markdown files on disk.');
    expect(raw.workspace.fs.readFile).not.toHaveBeenCalled();
    expect(raw.workspace.fs.readDirectory).not.toHaveBeenCalled();
  });

  it('rejects cancelled reads without displaying an error document', async () => {
    const { api, raw } = mockApi();
    const controller = new AbortController();
    controller.abort();
    await expect(stem.renderPreview(previewUri(root), api, controller.signal)).rejects.toThrow();
    expect(raw.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('uses POSIX relative paths for Windows drives and UNC paths', () => {
    expect(stem.relativePath('C:\\project with spaces', 'C:\\project with spaces\\blocks\\nested\\api.md')).toBe('blocks/nested/api.md');
    expect(stem.relativePath('\\\\server\\share\\project', '\\\\server\\share\\project\\views\\api.md')).toBe('views/api.md');
  });

  it('reads local snapshots before cache and honors useRemote without changing cacheDir behavior', async () => {
    const localGraph = { version: '1', namespace: 'other', publishedAt: '', contentSha: 'local', blocks: [], renames: [] };
    const remoteGraph = { ...localGraph, contentSha: 'remote' };
    await writeProjectFile(root, '.stem/config.json', JSON.stringify({ cacheDir: 'ignored', namespaces: { other: { localPath: 'sibling', graphUrl: 'unused' } } }));
    await writeProjectFile(root, 'sibling/.stem/cache/stem-graph.json', JSON.stringify(localGraph));
    await writeProjectFile(root, '.stem/cache/namespaces/other.json', JSON.stringify({ graph: remoteGraph, fetchedAt: 'not a date' }));
    const { api } = mockApi();
    const before = Date.now();
    const local = (await stem.loadProjectSnapshot(api, fileUri(root))).snapshot.externalGraphs.get('other');
    expect(local?.graph.contentSha).toBe('local');
    expect(local?.isLocalFallback).toBe(true);
    expect(Date.parse(local!.fetchedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(local!.fetchedAt)).toBeLessThanOrEqual(Date.now());
    expect((await stem.loadProjectSnapshot(api, fileUri(root), { useRemote: true })).snapshot.externalGraphs.get('other')).toEqual({
      graph: remoteGraph, fetchedAt: 'not a date', isLocalFallback: false
    });
  });
});

describe('preview refresh', () => {
  it('debounces only project documents while a preview is open and cancels immediately', () => {
    vi.useFakeTimers();
    let open = false;
    const provider = {
      getTrackedProjects: () => open ? [root] : [], hasProject: () => open,
      cancelProject: vi.fn(), refreshProject: vi.fn()
    };
    const watchers = new stem.StemPreviewWatcherManager(provider, {
      isAutoRefreshEnabled: () => true, getRefreshDebounceMs: () => 250
    });
    const document = openDocument(path.join(root, 'blocks/auth.md'), () => '');
    watchers.documentChanged(document);
    expect(provider.cancelProject).not.toHaveBeenCalled();
    open = true;
    watchers.documentChanged(openDocument(path.join(root + '-other', 'auth.md'), () => ''));
    watchers.documentChanged({ uri: uri('stem-preview:/view/api.md') } as vscode.TextDocument);
    expect(provider.cancelProject).not.toHaveBeenCalled();
    watchers.documentChanged(document);
    vi.advanceTimersByTime(200);
    watchers.documentChanged(document);
    expect(provider.cancelProject).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(249);
    expect(provider.refreshProject).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(provider.refreshProject).toHaveBeenCalledExactlyOnceWith(root);
    watchers.documentChanged(document);
    open = false;
    vi.advanceTimersByTime(250);
    expect(provider.refreshProject).toHaveBeenCalledTimes(1);
    watchers.dispose();
  });

  it('returns the latest result to overlapping requests and stops obsolete loading', async () => {
    const { api, raw, documents } = mockApi();
    let release!: () => void;
    let started!: () => void;
    const readStarted = new Promise<void>((resolve) => { started = resolve; });
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const read = raw.workspace.fs.readFile.getMockImplementation()!;
    raw.workspace.fs.readFile.mockImplementation(async (target) => {
      if (target.fsPath.endsWith('auth.md')) { started(); await paused; }
      return read(target);
    });
    const provider = new stem.StemPreviewProvider({}, { ...api, EventEmitter: class {
      event = () => ({ dispose() {} });
      fire() {}
    } });
    const target = previewUri(root);
    provider.track(target);
    const first = provider.provideTextDocumentContent(target);
    await readStarted;
    documents.push(openDocument(path.join(root, 'blocks/auth.md'), () => '---\nid: auth\n---\nLatest.'));
    const second = provider.provideTextDocumentContent(target);
    expect(await second).toBe('Latest.\n');
    release();
    expect(await first).toBe('Latest.\n');
    expect(provider.untrack(target)).toBe(root);
    expect(provider.hasProject(root)).toBe(false);
  });
});
