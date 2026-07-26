const { execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

let vscode = null;
try {
  vscode = require('vscode');
} catch {
  // The VS Code module is only available inside the extension host. Tests import
  // pure helpers from this file without activating the extension.
}

const execFileAsync = promisify(execFile);
const PREVIEW_SCHEME = 'stem-preview';
const DEFAULT_REFRESH_DEBOUNCE_MS = 250;
const WATCH_PATTERNS = [
  'views/**/*.md',
  'blocks/**/*.md',
  'blocks/schemas/**/*.{yaml,yml}',
  '.stem/config.json'
];

function activate(context) {
  assertVscode();
  const provider = new StemPreviewProvider(context);
  const watchers = new StemPreviewWatcherManager(provider);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, provider),
    vscode.commands.registerCommand('stem.previewToSide', async () => {
      await openPreviewToSide(provider, watchers);
    }),
    vscode.commands.registerCommand('stem.refreshPreview', () => {
      provider.refresh();
    }),
    watchers
  );
}

function deactivate() {}

class StemPreviewProvider {
  constructor(context) {
    this.context = context;
    this.emitter = new vscode.EventEmitter();
    this.onDidChange = this.emitter.event;
    this.openPreviewUrisByProject = new Map();
  }

  provideTextDocumentContent(uri) {
    return renderPreview(uri, this.context.extensionUri);
  }

  track(uri) {
    const params = parsePreviewUri(uri);
    if (params === null) {
      return;
    }

    const tracked = this.openPreviewUrisByProject.get(params.projectRoot) ?? new Set();
    tracked.add(uri.toString());
    this.openPreviewUrisByProject.set(params.projectRoot, tracked);
  }

  refresh() {
    for (const uriTexts of this.openPreviewUrisByProject.values()) {
      this.fireUris(uriTexts);
    }
  }

  refreshProject(projectRoot) {
    const uriTexts = this.openPreviewUrisByProject.get(projectRoot);
    if (uriTexts === undefined) {
      return;
    }
    this.fireUris(uriTexts);
  }

  fireUris(uriTexts) {
    for (const uriText of uriTexts) {
      this.emitter.fire(vscode.Uri.parse(uriText));
    }
  }
}

class StemPreviewWatcherManager {
  constructor(provider) {
    this.provider = provider;
    this.watchersByProject = new Map();
    this.refreshTimers = new Map();
  }

  watchProject(projectRoot) {
    if (!isAutoRefreshEnabled() || this.watchersByProject.has(projectRoot)) {
      return;
    }

    const disposables = WATCH_PATTERNS.map((pattern) => {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(projectRoot), pattern)
      );
      watcher.onDidChange(() => this.scheduleRefresh(projectRoot));
      watcher.onDidCreate(() => this.scheduleRefresh(projectRoot));
      watcher.onDidDelete(() => this.scheduleRefresh(projectRoot));
      return watcher;
    });

    this.watchersByProject.set(projectRoot, disposables);
  }

  scheduleRefresh(projectRoot) {
    if (!isAutoRefreshEnabled()) {
      return;
    }

    const existingTimer = this.refreshTimers.get(projectRoot);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.refreshTimers.delete(projectRoot);
      this.provider.refreshProject(projectRoot);
    }, getRefreshDebounceMs());
    this.refreshTimers.set(projectRoot, timer);
  }

  dispose() {
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();

    for (const disposables of this.watchersByProject.values()) {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    }
    this.watchersByProject.clear();
  }
}

async function openPreviewToSide(provider, watchers) {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    throw new Error('Open a Stem view Markdown file before previewing.');
  }

  const document = editor.document;
  if (document.uri.scheme !== 'file' || document.languageId !== 'markdown') {
    throw new Error('Stem preview is available for Markdown files on disk.');
  }

  const viewId = getFrontmatterId(document.getText());
  if (viewId === null) {
    throw new Error('Stem preview requires a view frontmatter id.');
  }

  const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
  if (projectRoot === null) {
    throw new Error('No Stem project root found for the active file.');
  }

  const previewUri = createPreviewUri(projectRoot, viewId, document.uri);
  provider.track(previewUri);
  watchers.watchProject(projectRoot);
  await vscode.commands.executeCommand('markdown.showPreviewToSide', previewUri);
}

async function renderPreview(uri, extensionUri) {
  const params = parsePreviewUri(uri);
  if (params === null) {
    return 'Stem preview could not resolve the requested view.';
  }

  try {
    const rendered = await runStemPreview(params.projectRoot, params.viewId, extensionUri);
    return rendered.stdout;
  } catch (error) {
    return formatPreviewError(error);
  }
}

async function runStemPreview(projectRoot, viewId, extensionUri) {
  const resolved = resolveStemCommand({
    configuredCliPath: getConfiguredCliPath(),
    projectRoot,
    extensionRoot: extensionUri.fsPath,
    pathExists: existsSync,
    nodePath: process.execPath
  });
  return execFileAsync(resolved.command, [...resolved.args, 'preview', 'view', viewId], { cwd: projectRoot });
}

function resolveStemCommand({ configuredCliPath, projectRoot, extensionRoot, pathExists, nodePath }) {
  const trimmedCliPath = configuredCliPath.trim();
  if (trimmedCliPath.length > 0) {
    return { command: trimmedCliPath, args: [] };
  }

  const workspaceCli = path.join(projectRoot, 'dist', 'cli', 'index.js');
  if (pathExists(workspaceCli)) {
    return { command: nodePath, args: [workspaceCli] };
  }

  const bundledCli = path.resolve(extensionRoot, '..', '..', 'dist', 'cli', 'index.js');
  if (pathExists(bundledCli)) {
    return { command: nodePath, args: [bundledCli] };
  }

  return { command: 'stem', args: [] };
}

function createPreviewUri(projectRoot, viewId, sourceUri) {
  return vscode.Uri.parse(createPreviewUriText(projectRoot, viewId, sourceUri.toString()));
}

function createPreviewUriText(projectRoot, viewId, sourceUriText) {
  const query = new URLSearchParams({
    root: projectRoot,
    view: viewId,
    source: sourceUriText
  });
  return `${PREVIEW_SCHEME}:/${encodeURIComponent(viewId)}.md?${query.toString()}`;
}

function parsePreviewUri(uri) {
  const params = new URLSearchParams(uri.query);
  const projectRoot = params.get('root');
  const viewId = params.get('view');
  const source = params.get('source');
  if (projectRoot === null || projectRoot.length === 0 || viewId === null || viewId.length === 0) {
    return null;
  }

  return { projectRoot, viewId, source };
}

function findProjectRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(current, '.stem'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function getFrontmatterId(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (match === null) {
    return null;
  }

  const frontmatter = match[1] ?? '';
  const idMatch = /^id:\s*["']?([A-Za-z0-9_-]+)["']?\s*$/m.exec(frontmatter);
  return idMatch?.[1] ?? null;
}

function formatPreviewError(error) {
  return `# Stem Preview Error\n\n\`\`\`text\n${toErrorMessage(error)}\n\`\`\`\n`;
}

function toErrorMessage(error) {
  if (error instanceof Error) {
    const detail = 'stderr' in error && typeof error.stderr === 'string' && error.stderr.length > 0
      ? `\n${error.stderr}`
      : '';
    return `${error.message}${detail}`;
  }
  return String(error);
}

function getConfiguredCliPath() {
  return vscode.workspace.getConfiguration('stem').get('cliPath', '').trim();
}

function isAutoRefreshEnabled() {
  return vscode.workspace.getConfiguration('stem').get('preview.autoRefresh', true);
}

function getRefreshDebounceMs() {
  const configured = vscode.workspace.getConfiguration('stem').get('preview.refreshDebounceMs', DEFAULT_REFRESH_DEBOUNCE_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_REFRESH_DEBOUNCE_MS;
}

function assertVscode() {
  if (vscode === null) {
    throw new Error('The Stem VS Code extension must be activated inside the VS Code extension host.');
  }
}

module.exports = {
  activate,
  deactivate,
  _private: {
    DEFAULT_REFRESH_DEBOUNCE_MS,
    PREVIEW_SCHEME,
    WATCH_PATTERNS,
    createPreviewUriText,
    findProjectRoot,
    formatPreviewError,
    getFrontmatterId,
    parsePreviewUri,
    resolveStemCommand,
    toErrorMessage
  }
};
