import path from 'node:path';
import { realpath } from 'node:fs/promises';
import type * as vscode from 'vscode';
import {
  analyzeProject,
  decodeExternalSnapshotEnvelope,
  isExternalStemGraphShape,
  normalizeStemConfig,
  parseConfigJson,
  compose,
  parseBlockReference,
  DEFAULT_COMPOSITION_LIMITS,
  STEM_CONFIG_FILE
} from '@stemdev/core';
import type {
  PortableStemConfig,
  ProjectSnapshot,
  SourceDocument,
  Diagnostic,
  CompositionLimits,
  CompositionResult,
  ExternalSnapshotState
} from '@stemdev/core';

export type ProjectApi = Pick<typeof vscode, 'Uri' | 'workspace'>;

/** Only stable inputs used by snapshot reads; never enumerate host API objects. */
type ReadApi = {
  readonly Uri: ProjectApi['Uri'];
  readonly workspace: {
    readonly fs: ProjectApi['workspace']['fs'];
    readonly textDocuments: readonly Pick<vscode.TextDocument, 'uri' | 'getText'>[];
  };
};

export class PreviewFailure extends Error {
  readonly code = 1;
  readonly stderr: string;
  constructor(message: string) {
    super(message);
    this.stderr = message;
  }
}

export function formatDiagnostic(issue: Diagnostic): string {
  return (
    issue.severity +
    ' ' +
    issue.code +
    ': ' +
    issue.message +
    (issue.location
      ? ' (' + issue.location.sourceId + ':' + issue.location.range.startOffset + ')'
      : '')
  );
}

function pathApi(root: string) {
  return /^[A-Za-z]:[\\/]|^\\\\/.test(root) ? path.win32 : path;
}

export function relativePath(root: string, filePath: string): string {
  return pathApi(root).relative(root, filePath).replaceAll('\\', '/');
}

export function isInProject(root: string, uri: Pick<vscode.Uri, 'scheme' | 'fsPath'>): boolean {
  if (uri.scheme !== 'file') return false;
  const relative = relativePath(root, uri.fsPath);
  return relative !== '..' && !relative.startsWith('../') && !pathApi(root).isAbsolute(relative);
}

function requireFile(uri: vscode.Uri): void {
  if (uri.scheme !== 'file')
    throw new PreviewFailure('Stem preview is available for Markdown files on disk.');
}

function hasCode(error: unknown, ...codes: string[]): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    codes.includes(String(error.code))
  );
}

function missing(error: unknown): boolean {
  return hasCode(error, 'FileNotFound', 'ENOENT', 'ENOTDIR', 'FileNotADirectory');
}

function ioFailure(error: unknown, filePath: string, fallback: string): PreviewFailure {
  return new PreviewFailure(
    hasCode(error, 'NoPermissions', 'EACCES', 'EPERM')
      ? `Permission denied: ${filePath}.`
      : fallback
  );
}

export async function findProjectRootAsync(
  api: ProjectApi,
  source: vscode.Uri
): Promise<string | null> {
  requireFile(source);
  let current = path.dirname(source.fsPath);
  while (true) {
    const stemPath = path.join(current, '.stem/config.json');
    try {
      if ((await api.workspace.fs.stat(api.Uri.file(stemPath))).type & 1) return current;
    } catch (error) {
      if (!missing(error)) throw ioFailure(error, stemPath, `Directory not found: ${stemPath}.`);
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function readText(api: ReadApi, uri: vscode.Uri, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  requireFile(uri);
  const document = api.workspace.textDocuments.find(
    (candidate) =>
      candidate.uri.scheme === 'file' && relativePath(uri.fsPath, candidate.uri.fsPath) === ''
  );
  if (document !== undefined) return document.getText();
  const bytes = await api.workspace.fs.readFile(uri);
  signal?.throwIfAborted();
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
}

async function loadConfig(
  api: ReadApi,
  root: vscode.Uri,
  signal?: AbortSignal
): Promise<PortableStemConfig> {
  const uri = api.Uri.joinPath(root, STEM_CONFIG_FILE);
  let content: string;
  try {
    content = await readText(api, uri, signal);
  } catch (error) {
    signal?.throwIfAborted();
    if (missing(error)) throw new PreviewFailure(`Stem config not found at ${uri.fsPath}.`);
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
  api: ProjectApi,
  root: vscode.Uri,
  directory: string,
  signal?: AbortSignal
): Promise<vscode.Uri[]> {
  const scanRoot = api.Uri.joinPath(root, directory);
  const found: vscode.Uri[] = [];
  const physicalProject = await realpath(root.fsPath);
  const physicalRoot = await realpath(scanRoot.fsPath).catch((error: unknown) => {
    if (missing(error)) return scanRoot.fsPath;
    throw error;
  });
  const within = (parent: string, child: string) => {
    const relative = relativePath(parent, child);
    return (
      relative !== '..' && !relative.startsWith('../') && !pathApi(parent).isAbsolute(relative)
    );
  };
  if (!within(physicalProject, physicalRoot))
    throw new PreviewFailure('Source directory escapes the project.');
  const ancestors = new Set<string>();
  async function walk(uri: vscode.Uri): Promise<void> {
    signal?.throwIfAborted();
    const physical = await realpath(uri.fsPath).catch((error: unknown) => {
      if (missing(error)) return uri.fsPath;
      throw error;
    });
    if (!within(physicalRoot, physical))
      throw new PreviewFailure('Source directory escapes blocksDir.');
    if (ancestors.has(physical)) throw new PreviewFailure('Source directory cycle.');
    ancestors.add(physical);
    let entries: [string, vscode.FileType][];
    try {
      entries = await api.workspace.fs.readDirectory(uri);
    } catch (error) {
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
        try {
          type = (await api.workspace.fs.stat(child)).type;
        } catch {
          signal?.throwIfAborted();
          continue;
        } // Broken links are ignored by fast-glob.
      }
      if (type & 2) {
        if (name === 'node_modules' || name === 'dist') continue;
        await walk(child);
      } else if (type & 1 && name.endsWith('.md')) {
        if (!within(physicalRoot, await realpath(child.fsPath)))
          throw new PreviewFailure('Source file escapes blocksDir.');
        found.push(child);
      }
    }
    ancestors.delete(physical);
  }
  await walk(scanRoot);
  return found.sort((a, b) =>
    relativePath(root.fsPath, a.fsPath).localeCompare(relativePath(root.fsPath, b.fsPath))
  );
}

export async function loadProjectSnapshot(
  api: ProjectApi,
  root: vscode.Uri,
  options: { signal?: AbortSignal; useRemote?: boolean } = {}
): Promise<{
  snapshot: ProjectSnapshot;
  config: PortableStemConfig;
  externalGraphs: ReadonlyMap<string, ExternalSnapshotState>;
  warnings: string[];
}> {
  requireFile(root);
  const { signal } = options;
  const originals = api.workspace.textDocuments
    .filter((document) => document.uri.scheme === 'file')
    .map((document) => ({ document, content: document.getText() }));
  // Capture open text before asynchronous I/O without reading unrelated API getters.
  const captured: ReadApi = {
    Uri: api.Uri,
    workspace: {
      fs: api.workspace.fs,
      textDocuments: originals.map(({ document, content }) => ({
        uri: document.uri,
        getText: () => content
      }))
    }
  };
  const config = await loadConfig(captured, root, signal);
  const blockFiles = await discover(api, root, config.blocksDir, signal);
  for (const { document } of originals) {
    const relative = relativePath(root.fsPath, document.uri.fsPath);
    if (
      relative.startsWith(config.blocksDir + '/') &&
      relative.endsWith('.md') &&
      !relative
        .slice(config.blocksDir.length + 1)
        .split('/')
        .some(
          (segment) => segment.startsWith('.') || segment === 'node_modules' || segment === 'dist'
        ) &&
      !blockFiles.some((uri) => uri.toString() === document.uri.toString())
    )
      blockFiles.push(document.uri);
  }
  blockFiles.sort((a, b) =>
    relativePath(root.fsPath, a.fsPath).localeCompare(relativePath(root.fsPath, b.fsPath))
  );
  async function documents(files: vscode.Uri[]): Promise<SourceDocument[]> {
    const result: SourceDocument[] = [];
    for (const uri of files) {
      try {
        result.push({
          content: await readText(captured, uri, signal),
          sourceId: relativePath(root.fsPath, uri.fsPath)
        });
      } catch (error) {
        signal?.throwIfAborted();
        throw ioFailure(
          error,
          uri.fsPath,
          missing(error) ? `File not found: ${uri.fsPath}.` : `Failed to read file: ${uri.fsPath}.`
        );
      }
    }
    return result;
  }
  const localInstance = {};
  const snapshot: ProjectSnapshot = {
    localInstance,
    instances: [
      {
        handle: localInstance,
        sources: await documents(blockFiles),
        bindings: Object.keys(config.namespaces).map((alias) => ({
          alias,
          unavailable: 'unavailable-source'
        }))
      }
    ],
    outputs: {
      complete: true,
      targets: Object.values(config.outputSets).flatMap((set) =>
        set.targets.map((target) =>
          target.source.kind === 'block'
            ? { kind: 'block' as const, reference: parseBlockReference(target.source.ref)! }
            : { kind: 'file' as const, sourceId: target.source.path }
        )
      )
    }
  };
  const externalGraphs = new Map<string, ExternalSnapshotState>();
  const warnings: string[] = [];
  for (const [namespace, namespaceConfig] of Object.entries(config.namespaces)) {
    if (!options.useRemote && namespaceConfig.localPath !== undefined) {
      const local = api.Uri.joinPath(
        root,
        namespaceConfig.localPath,
        '.stem/cache/stem-graph.json'
      );
      let content: string | undefined;
      try {
        content = await readText(captured, local, signal);
      } catch {
        signal?.throwIfAborted();
        warnings.push(
          `Local path for namespace "${namespace}" not found. Falling back to graphUrl cache.`
        );
      }
      if (content !== undefined) {
        try {
          const graph: unknown = JSON.parse(content);
          if (isExternalStemGraphShape(graph)) {
            externalGraphs.set(namespace, {
              graph,
              fetchedAt: new Date().toISOString(),
              isLocalFallback: true
            });
            continue;
          }
        } catch {
          /* Invalid local graphs fall through silently. */
        }
      }
    }
    try {
      const content = await readText(
        captured,
        api.Uri.joinPath(root, '.stem/cache/namespaces', `${namespace}.json`),
        signal
      );
      const envelope: unknown = JSON.parse(content);
      const decoded = decodeExternalSnapshotEnvelope(envelope);
      if (decoded !== undefined) externalGraphs.set(namespace, decoded);
    } catch {
      signal?.throwIfAborted(); /* Missing/invalid cached envelopes are ignored. */
    }
  }
  signal?.throwIfAborted();
  if (
    originals.some(
      ({ document, content }) =>
        !api.workspace.textDocuments.includes(document) || document.getText() !== content
    ) ||
    api.workspace.textDocuments.some(
      (document) =>
        document.uri.scheme === 'file' && !originals.some((item) => item.document === document)
    )
  )
    throw new PreviewFailure('Inputs changed during preview.');
  return { snapshot, config, warnings, externalGraphs };
}

export async function renderProjectPreview(
  api: ProjectApi,
  root: vscode.Uri,
  source: vscode.Uri,
  signal?: AbortSignal,
  limits: CompositionLimits = DEFAULT_COMPOSITION_LIMITS
): Promise<CompositionResult> {
  const { snapshot, config } = await loadProjectSnapshot(
    api,
    root,
    signal === undefined ? {} : { signal }
  );
  requireFile(source);
  const sourceId = relativePath(root.fsPath, source.fsPath);
  if (!isInProject(root.fsPath, source) || !sourceId.startsWith(config.blocksDir + '/'))
    throw new PreviewFailure('Active file is outside blocksDir.');
  signal?.throwIfAborted();
  const analysis = analyzeProject(snapshot);
  const result = compose(
    analysis,
    { kind: 'file', instance: analysis.localInstance!, sourceId },
    limits
  );
  signal?.throwIfAborted();
  return result;
}
