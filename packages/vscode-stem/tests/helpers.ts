import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { vi } from 'vitest';
import type * as vscode from 'vscode';
import type * as project from '../src/project.js';

export function uri(text: string): vscode.Uri {
  const parsed = new URL(text);
  return {
    scheme: parsed.protocol.slice(0, -1), fsPath: parsed.protocol === 'file:' ? fileURLToPath(parsed) : parsed.pathname,
    path: parsed.pathname, query: parsed.search.slice(1), toString: () => text
  } as vscode.Uri;
}

export function fileUri(filePath: string): vscode.Uri { return uri(pathToFileURL(filePath).href); }

export function mockApi() {
  const documents: vscode.TextDocument[] = [];
  const api = {
    Uri: { file: fileUri, parse: uri, joinPath: (base: vscode.Uri, ...parts: string[]) => fileUri(path.join(base.fsPath, ...parts)) },
    workspace: {
      textDocuments: documents,
      fs: {
        readFile: vi.fn(async (target: vscode.Uri) => new Uint8Array(await fs.readFile(target.fsPath))),
        readDirectory: vi.fn(async (target: vscode.Uri) => (await fs.readdir(target.fsPath, { withFileTypes: true })).map(
          (entry): [string, vscode.FileType] => [entry.name, entry.isSymbolicLink() ? 64 : entry.isDirectory() ? 2 : 1]
        )),
        stat: vi.fn(async (target: vscode.Uri) => {
          const stat = await fs.stat(target.fsPath);
          return { type: stat.isDirectory() ? 2 : 1, size: stat.size, ctime: stat.ctimeMs, mtime: stat.mtimeMs };
        })
      }
    }
  };
  return { api: api as unknown as project.ProjectApi, raw: api, documents };
}

export function openDocument(filePath: string, getText: () => string): vscode.TextDocument {
  return { uri: fileUri(filePath), getText, languageId: 'markdown', isDirty: true } as vscode.TextDocument;
}

interface Provider {
  track(uri: vscode.Uri): void;
  untrack(uri: vscode.Uri): string | null;
  hasProject(root: string): boolean;
  getTrackedProjects(): string[];
  provideTextDocumentContent(uri: vscode.Uri, token?: vscode.CancellationToken): Promise<string>;
  cancelProject(root: string): void;
  refreshProject(root: string): void;
}
interface Watchers {
  documentChanged(document: vscode.TextDocument): void;
  scheduleRefresh(root: string): void;
  dispose(): void;
}
interface Helpers {
  renderProjectPreview: typeof project.renderProjectPreview;
  loadProjectSnapshot: typeof project.loadProjectSnapshot;
  relativePath: typeof project.relativePath;
  renderPreview(uri: vscode.Uri, api: project.ProjectApi, signal?: AbortSignal): Promise<string>;
  createPreviewUriText(root: string, view: string, source: string): string;
  toPreviewDisplayMarkdown(content: string): string;
  StemPreviewProvider: new (context: object, api: unknown) => Provider;
  StemPreviewWatcherManager: new (provider: Pick<Provider, 'getTrackedProjects' | 'refreshProject' | 'cancelProject' | 'hasProject'>, options: object) => Watchers;
}
const require = createRequire(import.meta.url);
export const stem = (require('../dist/extension.js') as { _private: Helpers })._private;
export const vscodeMock = require('vscode') as { __stemTestMock: boolean };

export function previewUri(root: string, view = 'api'): vscode.Uri {
  return uri(stem.createPreviewUriText(root, view, fileUri(path.join(root, 'views/api.md')).toString()));
}

export async function writeProjectFile(root: string, file: string, content: string): Promise<void> {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}
