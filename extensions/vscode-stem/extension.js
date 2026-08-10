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
const PREVIEW_EXEC_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
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
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (document.uri.scheme !== PREVIEW_SCHEME) {
        return;
      }

      const projectRoot = provider.untrack(document.uri);
      if (projectRoot !== null && !provider.hasProject(projectRoot)) {
        watchers.unwatchProject(projectRoot);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('stem.preview.autoRefresh') ||
        event.affectsConfiguration('stem.preview.refreshDebounceMs')
      ) {
        watchers.applyConfiguration();
      }
    }),
    watchers
  );
}

function deactivate() {}

class StemPreviewProvider {
  constructor(context, vscodeApi = vscode) {
    this.context = context;
    this.vscode = vscodeApi;
    this.emitter = new this.vscode.EventEmitter();
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

  untrack(uri) {
    const params = parsePreviewUri(uri);
    if (params === null) {
      return null;
    }

    const tracked = this.openPreviewUrisByProject.get(params.projectRoot);
    if (tracked === undefined) {
      return params.projectRoot;
    }

    tracked.delete(uri.toString());
    if (tracked.size === 0) {
      this.openPreviewUrisByProject.delete(params.projectRoot);
    }
    return params.projectRoot;
  }

  hasProject(projectRoot) {
    return this.openPreviewUrisByProject.has(projectRoot);
  }

  getTrackedProjects() {
    return [...this.openPreviewUrisByProject.keys()];
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
      this.emitter.fire(this.vscode.Uri.parse(uriText));
    }
  }
}

class StemPreviewWatcherManager {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.vscode = options.vscodeApi ?? vscode;
    this.isAutoRefreshEnabled = options.isAutoRefreshEnabled ?? isAutoRefreshEnabled;
    this.getRefreshDebounceMs = options.getRefreshDebounceMs ?? getRefreshDebounceMs;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.watchersByProject = new Map();
    this.refreshTimers = new Map();
  }

  watchProject(projectRoot) {
    if (!this.isAutoRefreshEnabled() || this.watchersByProject.has(projectRoot)) {
      return;
    }

    const disposables = WATCH_PATTERNS.map((pattern) => {
      const watcher = this.vscode.workspace.createFileSystemWatcher(
        new this.vscode.RelativePattern(this.vscode.Uri.file(projectRoot), pattern)
      );
      watcher.onDidChange(() => this.scheduleRefresh(projectRoot));
      watcher.onDidCreate(() => this.scheduleRefresh(projectRoot));
      watcher.onDidDelete(() => this.scheduleRefresh(projectRoot));
      return watcher;
    });

    this.watchersByProject.set(projectRoot, disposables);
  }

  unwatchProject(projectRoot) {
    const timer = this.refreshTimers.get(projectRoot);
    if (timer !== undefined) {
      this.clearTimer(timer);
      this.refreshTimers.delete(projectRoot);
    }

    const disposables = this.watchersByProject.get(projectRoot);
    if (disposables === undefined) {
      return;
    }

    for (const disposable of disposables) {
      disposable.dispose();
    }
    this.watchersByProject.delete(projectRoot);
  }

  applyConfiguration() {
    if (!this.isAutoRefreshEnabled()) {
      this.disposeWatchers();
      return;
    }

    for (const projectRoot of this.provider.getTrackedProjects()) {
      this.watchProject(projectRoot);
    }
  }

  scheduleRefresh(projectRoot) {
    if (!this.isAutoRefreshEnabled()) {
      return;
    }

    const existingTimer = this.refreshTimers.get(projectRoot);
    if (existingTimer !== undefined) {
      this.clearTimer(existingTimer);
    }

    const timer = this.setTimer(() => {
      this.refreshTimers.delete(projectRoot);
      this.provider.refreshProject(projectRoot);
    }, this.getRefreshDebounceMs());
    this.refreshTimers.set(projectRoot, timer);
  }

  dispose() {
    this.disposeWatchers();
  }

  disposeWatchers() {
    for (const timer of this.refreshTimers.values()) {
      this.clearTimer(timer);
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

async function openPreviewToSide(provider, watchers, vscodeApi = vscode) {
  if (vscodeApi.workspace.isTrusted === false) {
    vscodeApi.window.showWarningMessage('Stem preview is disabled in untrusted workspaces because it runs the Stem CLI.');
    return;
  }

  const editor = vscodeApi.window.activeTextEditor;
  if (editor === undefined) {
    vscodeApi.window.showInformationMessage('Open a Stem view Markdown file before previewing.');
    return;
  }

  const document = editor.document;
  if (document.uri.scheme !== 'file' || document.languageId !== 'markdown') {
    vscodeApi.window.showInformationMessage('Stem preview is available for Markdown files on disk.');
    return;
  }

  const viewId = getFrontmatterId(document.getText());
  if (viewId === null) {
    vscodeApi.window.showInformationMessage('Stem preview requires a top-level frontmatter id, for example: id: api-view');
    return;
  }

  const projectRoot = findProjectRoot(path.dirname(document.uri.fsPath));
  if (projectRoot === null) {
    vscodeApi.window.showInformationMessage('No Stem project root found for the active file.');
    return;
  }

  const previewUri = createPreviewUri(projectRoot, viewId, document.uri, vscodeApi);
  provider.track(previewUri);
  watchers.watchProject(projectRoot);
  try {
    await vscodeApi.commands.executeCommand('markdown.showPreviewToSide', previewUri);
  } catch (error) {
    const untrackedProjectRoot = provider.untrack(previewUri);
    if (untrackedProjectRoot !== null && !provider.hasProject(untrackedProjectRoot)) {
      watchers.unwatchProject(untrackedProjectRoot);
    }
    throw error;
  }
}

async function renderPreview(uri, extensionUri) {
  const params = parsePreviewUri(uri);
  if (params === null) {
    return formatPreviewError(new Error('Stem preview could not resolve the requested view.'), {
      nextAction: 'Close this preview and open it again from a Stem view Markdown file.'
    });
  }

  try {
    const rendered = await runStemPreview(params.projectRoot, params.viewId, extensionUri);
    return toPreviewDisplayMarkdown(rendered.stdout);
  } catch (error) {
    const details = toPreviewErrorDetails(error);
    return formatPreviewError(error, {
      viewId: params.viewId,
      projectRoot: params.projectRoot,
      nextAction: getPreviewFailureNextAction(details)
    });
  }
}

async function runStemPreview(projectRoot, viewId, extensionUri) {
  const resolved = resolveStemCommand({
    configuredCliPath: getConfiguredCliPath(),
    projectRoot,
    extensionRoot: extensionUri.fsPath,
    pathExists: existsSync,
    nodePath: process.execPath,
    env: process.env
  });
  const args = [...resolved.args, 'preview', 'view', viewId];
  const execOptions = getPreviewExecOptions({
    command: resolved.command,
    args,
    cwd: projectRoot,
    nodePath: process.execPath,
    env: process.env,
    runtimeVersions: process.versions
  });
  try {
    return await execFileAsync(resolved.command, args, execOptions);
  } catch (error) {
    if (error !== null && typeof error === 'object') {
      error.stemCommandText = formatCommandText(resolved.command, args);
      error.stemCwd = projectRoot;
    }
    throw error;
  }
}

function resolveStemCommand({
  configuredCliPath,
  projectRoot,
  extensionRoot,
  pathExists,
  nodePath,
  env = process.env,
  runtimeVersions = process.versions
}) {
  const trimmedCliPath = configuredCliPath.trim();
  if (trimmedCliPath.length > 0) {
    if (isJavaScriptEntrypoint(trimmedCliPath)) {
      return { command: resolveNodeRuntime({ nodePath, env, pathExists, runtimeVersions }), args: [trimmedCliPath] };
    }
    return { command: trimmedCliPath, args: [] };
  }

  const workspaceCli = path.join(projectRoot, 'dist', 'cli', 'index.js');
  if (pathExists(workspaceCli)) {
    return { command: resolveNodeRuntime({ nodePath, env, pathExists, runtimeVersions }), args: [workspaceCli] };
  }

  const bundledCli = path.resolve(extensionRoot, '..', '..', 'dist', 'cli', 'index.js');
  if (pathExists(bundledCli)) {
    return { command: resolveNodeRuntime({ nodePath, env, pathExists, runtimeVersions }), args: [bundledCli] };
  }

  return { command: 'stem', args: [] };
}

function resolveNodeRuntime({ nodePath, env, pathExists, runtimeVersions = process.versions }) {
  if (!isElectronBackedNodePath(nodePath, runtimeVersions)) {
    return nodePath;
  }

  return findNodeOnPath(env, pathExists) ?? nodePath;
}

function findNodeOnPath(env, pathExists) {
  const pathValue = env.PATH ?? env.Path ?? env.path ?? '';
  if (pathValue.length === 0) {
    return null;
  }

  const executableNames = process.platform === 'win32' ? ['node.exe'] : ['node'];
  for (const directory of pathValue.split(path.delimiter)) {
    if (directory.trim().length === 0) {
      continue;
    }

    for (const executableName of executableNames) {
      const candidate = path.join(directory, executableName);
      if (pathExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function getPreviewExecOptions({ command, args, cwd, nodePath, env, runtimeVersions }) {
  const options = {
    cwd,
    maxBuffer: PREVIEW_EXEC_MAX_BUFFER_BYTES
  };

  if (shouldRunElectronAsNode({ command, args, nodePath, runtimeVersions })) {
    options.env = { ...env, ELECTRON_RUN_AS_NODE: '1' };
  }

  return options;
}

function shouldRunElectronAsNode({ command, args, nodePath, runtimeVersions }) {
  return (
    command === nodePath &&
    isElectronBackedNodePath(nodePath, runtimeVersions) &&
    typeof args[0] === 'string' &&
    isJavaScriptEntrypoint(args[0])
  );
}

function isElectronBackedNodePath(nodePath, runtimeVersions) {
  if (typeof runtimeVersions.electron === 'string' && runtimeVersions.electron.length > 0) {
    return true;
  }

  const executableName = path.basename(nodePath).toLowerCase();
  return [
    'code.exe',
    'code - insiders.exe',
    'code - oss.exe',
    'code',
    'code-insiders',
    'code-oss',
    'electron',
    'electron.exe'
  ].includes(executableName);
}

function createPreviewUri(projectRoot, viewId, sourceUri, vscodeApi = vscode) {
  return vscodeApi.Uri.parse(createPreviewUriText(projectRoot, viewId, sourceUri.toString(true)));
}

function createPreviewUriText(projectRoot, viewId, sourceUriText) {
  const query = new URLSearchParams({
    root: projectRoot,
    view: viewId,
    source: sourceUriText
  });
  return `${PREVIEW_SCHEME}:/view/${encodeURIComponent(viewId)}.md?${query.toString()}`;
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
  const idMatch = /^id:\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^#\r\n]+?))\s*(?:#.*)?$/m.exec(frontmatter);
  const id = (idMatch?.[1] ?? idMatch?.[2] ?? idMatch?.[3] ?? '').trim();
  return id.length > 0 ? id : null;
}

function toPreviewDisplayMarkdown(markdown) {
  return stripLeadingFrontmatter(markdown);
}

function stripLeadingFrontmatter(markdown) {
  const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
  if (match === null) {
    return markdown;
  }

  return markdown.slice(match[0].length);
}

function formatPreviewError(error, options = {}) {
  const details = toPreviewErrorDetails(error);
  const lines = ['# Stem Preview Error', ''];

  if (options.viewId !== undefined) {
    lines.push(`Stem could not render \`${options.viewId}\`.`, '');
  }

  if (details.commandText !== null) {
    lines.push('## Command', '', fencedCode(details.commandText), '');
  }

  if (options.projectRoot !== undefined || details.cwd !== null) {
    lines.push('## Project', '', `\`${options.projectRoot ?? details.cwd}\``, '');
  }

  if (details.exitCode !== null) {
    lines.push('## Exit Code', '', `\`${details.exitCode}\``, '');
  }

  if (details.stderr.length > 0) {
    lines.push('## stderr', '', fencedCode(details.stderr), '');
  }

  if (details.stdout.length > 0) {
    lines.push('## stdout', '', fencedCode(details.stdout), '');
  }

  lines.push('## Summary', '', details.message, '');

  if (options.nextAction !== undefined) {
    lines.push('## Next Action', '', options.nextAction, '');
  }

  return `${lines.join('\n')}\n`;
}

function toErrorMessage(error) {
  return toPreviewErrorDetails(error).message;
}

function toPreviewErrorDetails(error) {
  if (error instanceof Error) {
    return {
      message: cleanErrorMessage(error.message),
      stderr: getStringProperty(error, 'stderr'),
      stdout: getStringProperty(error, 'stdout'),
      exitCode: getExitCode(error),
      commandText: getStringProperty(error, 'stemCommandText') || getStringProperty(error, 'cmd') || null,
      cwd: getStringProperty(error, 'stemCwd') || null
    };
  }
  return {
    message: String(error),
    stderr: '',
    stdout: '',
    exitCode: null,
    commandText: null,
    cwd: null
  };
}

function getPreviewFailureNextAction(details) {
  if (details.exitCode === 'ENOENT' || /spawn .*ENOENT/u.test(details.message)) {
    return 'Build Stem in this workspace or set `stem.cliPath` to a Stem CLI executable or JavaScript entrypoint, then refresh this preview.';
  }

  return 'Run `stem check` in the project root, fix any reported errors, then refresh this preview.';
}

function cleanErrorMessage(message) {
  const trimmed = message.trim();
  if (trimmed.includes('\n')) {
    return trimmed.split(/\r?\n/)[0] ?? trimmed;
  }
  return trimmed;
}

function getStringProperty(value, property) {
  if (property in value && typeof value[property] === 'string') {
    return value[property].trim();
  }
  return '';
}

function getExitCode(error) {
  if (!('code' in error)) {
    return null;
  }

  const code = error.code;
  return typeof code === 'number' || typeof code === 'string' ? code : null;
}

function fencedCode(value) {
  return `\`\`\`text\n${value.replaceAll('```', '`\\`\\`')}\n\`\`\``;
}

function isJavaScriptEntrypoint(filePath) {
  return ['.js', '.mjs', '.cjs'].includes(path.extname(filePath).toLowerCase());
}

function formatCommandText(command, args) {
  return [command, ...args].map(quoteCommandPart).join(' ');
}

function quoteCommandPart(part) {
  if (!/[\s"]/u.test(part)) {
    return part;
  }
  return `"${part.replaceAll('"', '\\"')}"`;
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
    PREVIEW_EXEC_MAX_BUFFER_BYTES,
    StemPreviewWatcherManager,
    WATCH_PATTERNS,
    createPreviewUri,
    createPreviewUriText,
    findProjectRoot,
    findNodeOnPath,
    formatPreviewError,
    formatCommandText,
    getPreviewExecOptions,
    getPreviewFailureNextAction,
    getFrontmatterId,
    isElectronBackedNodePath,
    openPreviewToSide,
    parsePreviewUri,
    resolveNodeRuntime,
    resolveStemCommand,
    shouldRunElectronAsNode,
    stripLeadingFrontmatter,
    toPreviewDisplayMarkdown,
    toPreviewErrorDetails,
    toErrorMessage
  }
};
