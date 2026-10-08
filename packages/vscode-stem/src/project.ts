import path from 'node:path';
import type * as vscode from 'vscode';
import {
  analyzeProject, decodeExternalSnapshotEnvelope, decodeTagSchemaYaml, getDefaultPortableConfig,
  isExternalStemGraphShape, normalizeStemConfig, parseConfigJson, renderViewMarkdown, STEM_CONFIG_FILE
} from '@stemdev/core';
import type { PortableStemConfig, ProjectSnapshot, SourceDocument, ValidationIssue } from '@stemdev/core';

export type ProjectApi = Pick<typeof vscode, 'Uri' | 'workspace'>;

export class PreviewFailure extends Error {
  readonly code = 1;
  readonly stderr: string;
  constructor(message: string, issues: ValidationIssue[] = [], warnings: string[] = []) {
    super(message);
    this.stderr = [...warnings, message, ...issues.filter((issue) => issue.severity === 'error').map(formatDiagnostic)].join('\n');
  }
}

export function formatDiagnostic(issue: ValidationIssue): string {
  const location = issue.position === undefined ? issue.relativePath
    : `${issue.relativePath}:${issue.position.start.line}:${issue.position.start.column}`;
  return `${issue.severity.toUpperCase()} ${issue.code} ${location}: ${issue.message}`;
}

function pathApi(root: string) { return /^[A-Za-z]:[\\/]|^\\\\/.test(root) ? path.win32 : path; }

export function relativePath(root: string, filePath: string): string {
  return pathApi(root).relative(root, filePath).replaceAll('\\', '/');
}

export function isInProject(root: string, uri: Pick<vscode.Uri, 'scheme' | 'fsPath'>): boolean {
  if (uri.scheme !== 'file') return false;
  const relative = relativePath(root, uri.fsPath);
  return relative !== '..' && !relative.startsWith('../') && !pathApi(root).isAbsolute(relative);
}

function requireFile(uri: vscode.Uri): void {
  if (uri.scheme !== 'file') throw new PreviewFailure('Stem preview is available for Markdown files on disk.');
}

function hasCode(error: unknown, ...codes: string[]): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && codes.includes(String(error.code));
}

function missing(error: unknown): boolean { return hasCode(error, 'FileNotFound', 'ENOENT', 'ENOTDIR', 'FileNotADirectory'); }

function ioFailure(error: unknown, filePath: string, fallback: string): PreviewFailure {
  return new PreviewFailure(hasCode(error, 'NoPermissions', 'EACCES', 'EPERM') ? `Permission denied: ${filePath}.` : fallback);
}

export async function findProjectRootAsync(api: ProjectApi, source: vscode.Uri): Promise<string | null> {
  requireFile(source);
  let current = path.dirname(source.fsPath);
  while (true) {
    const stemPath = path.join(current, '.stem');
    try {
      if ((await api.workspace.fs.stat(api.Uri.file(stemPath))).type & 2) return current;
    } catch (error) {
      if (!missing(error)) throw ioFailure(error, stemPath, `Directory not found: ${stemPath}.`);
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function readText(api: ProjectApi, uri: vscode.Uri, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  requireFile(uri);
  const document = api.workspace.textDocuments.find((candidate) => candidate.uri.scheme === 'file'
    && relativePath(uri.fsPath, candidate.uri.fsPath) === '');
  if (document !== undefined) return document.getText();
  const bytes = await api.workspace.fs.readFile(uri);
  signal?.throwIfAborted();
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
}

async function loadConfig(api: ProjectApi, root: vscode.Uri, signal?: AbortSignal): Promise<PortableStemConfig> {
  const uri = api.Uri.joinPath(root, STEM_CONFIG_FILE);
  let content: string;
  try { content = await readText(api, uri, signal); }
  catch (error) {
    signal?.throwIfAborted();
    if (missing(error)) return getDefaultPortableConfig();
    throw new PreviewFailure(`Failed to read Stem config at ${uri.fsPath}.`);
  }
  const parsed = parseConfigJson(content, uri.fsPath);
  if (!parsed.success) throw new PreviewFailure(parsed.error.message);
  const normalized = normalizeStemConfig(parsed.data, uri.fsPath);
  if (!normalized.success) throw new PreviewFailure(normalized.error.message);
  return normalized.data;
}

/** Walk the scan root, following symlinks just as fast-glob does by default. */
async function discover(
  api: ProjectApi, root: vscode.Uri, directory: string, schema: boolean, excludedSubtree: string | undefined, signal?: AbortSignal
): Promise<vscode.Uri[]> {
  const scanRoot = api.Uri.joinPath(root, directory);
  const found: vscode.Uri[] = [];
  const excluded = excludedSubtree === undefined ? undefined : api.Uri.joinPath(root, excludedSubtree);
  async function walk(uri: vscode.Uri): Promise<void> {
    signal?.throwIfAborted();
    let entries: [string, vscode.FileType][];
    try { entries = await api.workspace.fs.readDirectory(uri); }
    catch (error) {
      signal?.throwIfAborted();
      if (missing(error)) return;
      throw ioFailure(error, scanRoot.fsPath, `Failed to scan files in ${scanRoot.fsPath}.`);
    }
    signal?.throwIfAborted();
    for (const [name, entryType] of entries) {
      if (name.startsWith('.')) continue;
      const child = api.Uri.joinPath(uri, name);
      let type = entryType;
      if (type & 64) {
        try { type = (await api.workspace.fs.stat(child)).type; }
        catch { signal?.throwIfAborted(); continue; } // Broken links are ignored by fast-glob.
      }
      if (type & 2) {
        if (name === 'node_modules' || name === 'dist') continue;
        if (excluded !== undefined && relativePath(excluded.fsPath, child.fsPath) === '') continue;
        await walk(child);
      } else if ((type & 1) && (schema ? /\.(yaml|yml)$/.test(name) : name.endsWith('.md'))) {
        found.push(child);
      }
    }
  }
  await walk(scanRoot);
  return found.sort((a, b) => relativePath(root.fsPath, a.fsPath).localeCompare(relativePath(root.fsPath, b.fsPath)));
}

export async function loadProjectSnapshot(
  api: ProjectApi, root: vscode.Uri, options: { signal?: AbortSignal; useRemote?: boolean } = {}
): Promise<{ snapshot: ProjectSnapshot; config: PortableStemConfig; warnings: string[] }> {
  requireFile(root);
  const { signal } = options;
  const config = await loadConfig(api, root, signal);
  const blockFiles = await discover(api, root, config.blocksDir, false, config.schemasDir, signal);
  const viewFiles = await discover(api, root, config.viewsDir, false, undefined, signal);
  async function documents(files: vscode.Uri[]): Promise<SourceDocument[]> {
    const result: SourceDocument[] = [];
    for (const uri of files) {
      try { result.push({ content: await readText(api, uri, signal), filePath: uri.fsPath, relativePath: relativePath(root.fsPath, uri.fsPath) }); }
      catch (error) {
        signal?.throwIfAborted();
        throw ioFailure(error, uri.fsPath, missing(error) ? `File not found: ${uri.fsPath}.` : `Failed to read file: ${uri.fsPath}.`);
      }
    }
    return result;
  }
  const snapshot: ProjectSnapshot = {
    blocks: await documents(blockFiles), views: await documents(viewFiles), schemas: new Map(),
    configuredNamespaces: config.namespaces, externalGraphs: new Map()
  };
  for (const uri of await discover(api, root, config.schemasDir, true, undefined, signal)) {
    let text: string;
    try { text = await readText(api, uri, signal); }
    catch (error) {
      signal?.throwIfAborted();
      throw ioFailure(error, uri.fsPath, missing(error) ? `File not found: ${uri.fsPath}.` : `Failed to read file: ${uri.fsPath}.`);
    }
    const decoded = decodeTagSchemaYaml(text);
    if (!decoded.success) throw new PreviewFailure(decoded.error.kind === 'yaml'
      ? `Failed to parse schema YAML at ${uri.fsPath}.`
      : `Schema file ${uri.fsPath} must define a string name and a required string array.`);
    snapshot.schemas.set(decoded.data.name, decoded.data);
  }
  const warnings: string[] = [];
  for (const [namespace, namespaceConfig] of Object.entries(config.namespaces)) {
    if (!options.useRemote && namespaceConfig.localPath !== undefined) {
      const local = api.Uri.joinPath(root, namespaceConfig.localPath, '.stem/cache/stem-graph.json');
      let content: string | undefined;
      try { content = await readText(api, local, signal); }
      catch { signal?.throwIfAborted(); warnings.push(`Local path for namespace "${namespace}" not found. Falling back to graphUrl cache.`); }
      if (content !== undefined) {
        try {
          const graph: unknown = JSON.parse(content);
          if (isExternalStemGraphShape(graph)) {
            snapshot.externalGraphs.set(namespace, { graph, fetchedAt: new Date().toISOString(), isLocalFallback: true });
            continue;
          }
        } catch { /* Invalid local graphs fall through silently. */ }
      }
    }
    try {
      const content = await readText(api, api.Uri.joinPath(root, '.stem/cache/namespaces', `${namespace}.json`), signal);
      const envelope: unknown = JSON.parse(content);
      const decoded = decodeExternalSnapshotEnvelope(envelope);
      if (decoded !== undefined) snapshot.externalGraphs.set(namespace, decoded);
    } catch { signal?.throwIfAborted(); /* Missing/invalid cached envelopes are ignored. */ }
  }
  signal?.throwIfAborted();
  return { snapshot, config, warnings };
}

export async function renderProjectPreview(api: ProjectApi, root: vscode.Uri, viewId: string, signal?: AbortSignal): Promise<string> {
  const { snapshot, warnings } = await loadProjectSnapshot(api, root, signal === undefined ? {} : { signal });
  signal?.throwIfAborted();
  const analysis = analyzeProject(snapshot, { nowMs: Date.now() });
  if (analysis.validation.hasErrors) {
    const count = analysis.validation.errorCount;
    throw new PreviewFailure(`Cannot render project with ${count} validation error${count === 1 ? '' : 's'}. Run stem check for details.`, analysis.validation.issues, warnings);
  }
  const view = analysis.views.find((candidate) => candidate.id === viewId);
  if (view === undefined) throw new PreviewFailure(`View "${viewId}" was not found.`, [], warnings);
  const rendered = renderViewMarkdown(view, analysis.blocks);
  if (!rendered.success) {
    const count = rendered.validation.errorCount;
    throw new PreviewFailure(`Cannot render view "${view.id}" with ${count} validation error${count === 1 ? '' : 's'}.`, rendered.validation.issues, warnings);
  }
  signal?.throwIfAborted();
  return rendered.markdown + (rendered.markdown.endsWith('\n') ? '' : '\n');
}
