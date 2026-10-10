const { execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { findProjectRootAsync, isInProject, loadProjectSnapshot, renderProjectPreview, relativePath } = require('./src/project.ts');

let vscode = null;
try {
  vscode = require('vscode');
} catch {
  // The VS Code module is only available inside the extension host. Tests import
  // pure helpers from this file without activating the extension.
}

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
  const watchers = new StemPreviewWatcherManager(provider, { getWatchPatterns: () => ['**/*'] });

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, provider),
    vscode.commands.registerCommand('stem.previewToSide', async () => {
      await openPreviewToSide(provider, watchers);
    }),
    vscode.commands.registerCommand('stem.refreshPreview', () => {
      provider.refresh();
    }),
    registerMcpCommand(context),
    vscode.workspace.onDidChangeTextDocument(({ document }) => watchers.documentChanged(document)),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (document.uri.scheme !== PREVIEW_SCHEME) {
        watchers.documentChanged(document);
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
    watchers,
    provider
  );

  // First-load notification for MCP
  (async () => {
    if (!vscode.workspace.workspaceFolders) return;
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    
    if (existsSync(path.join(root, '.stem', 'config.json'))) {
      const dismissed = context.globalState.get('stem.mcp.dismissed');
      const notNow = context.workspaceState.get('stem.mcp.notNow');
      const hasMcp = existsSync(path.join(root, '.cursor', 'mcp.json')) || existsSync(path.join(root, '.vscode', 'mcp.json'));
      
      if (!dismissed && !notNow && !hasMcp) {
        const result = await vscode.window.showInformationMessage(
          'Stem project detected. Would you like to enable the Stem MCP server for AI assistants in this workspace?',
          'Enable', 'Not Now', 'Don\'t Ask Again'
        );
        if (result === 'Enable') {
          try {
            await vscode.commands.executeCommand('stem.enableMcp');
          } catch (e) {
            console.error('Failed to enable MCP', e);
          }
        } else if (result === 'Not Now') {
          context.workspaceState.update('stem.mcp.notNow', true);
        } else if (result === 'Don\'t Ask Again') {
          context.globalState.update('stem.mcp.dismissed', true);
        }
      }
    }
  })().catch(e => console.error('Stem: MCP notification error', e));
}

function registerMcpCommand(context, vscodeApi = vscode, options = {}) {
  return vscodeApi.commands.registerCommand('stem.enableMcp', () => enableMcpForWorkspace(context, vscodeApi, options));
}

async function enableMcpForWorkspace(context, vscodeApi = vscode, options = {}) {
  if (vscodeApi.workspace.isTrusted === false) {
    vscodeApi.window.showWarningMessage('Stem MCP setup requires a trusted workspace.');
    return;
  }
  if (!vscodeApi.workspace.workspaceFolders?.length) {
    vscodeApi.window.showErrorMessage('No workspace folder open.');
    return;
  }
  const root = vscodeApi.workspace.workspaceFolders[0].uri.fsPath;
  const fs = options.fs ?? require('node:fs');
  const written = [];
  try {
    let mcpCommand = 'npx';
    let mcpArgs = ['-y', '@stemdev/cli@latest', 'mcp'];
    try {
      await new Promise((res, rej) => (options.execFile ?? execFile)('stem', ['--version'], { timeout: 3000 }, (err) => err ? rej(err) : res()));
      mcpCommand = 'stem';
      mcpArgs = ['mcp'];
    } catch {
      // CLI discovery is unchanged; its repair belongs to R03.
    }

    const stemEntry = { type: 'stdio', command: mcpCommand, args: mcpArgs, cwd: root };
    const plans = [
      prepareMcpConfig(path.join(root, '.cursor', 'mcp.json'), 'mcpServers', stemEntry, fs),
      prepareMcpConfig(path.join(root, '.vscode', 'mcp.json'), 'servers', stemEntry, fs)
    ];
    writeMcpConfigs(plans, vscodeApi, fs, written);
    const legacy = plans.filter(plan => plan.hasLegacyServers).map(plan => plan.filePath);
    const result = written.length ? 'saved' : 'already configured';
    vscodeApi.window.showInformationMessage(
      `Stem MCP configuration ${result} for the first workspace folder: ${root}. Review it in your editor before starting the server.` +
      (legacy.length ? ` Unrelated mcpServers entries remain in ${legacy.join(', ')}; merge those manually.` : '')
    );
  } catch (error) {
    const result = written.length
      ? ` Updated only: ${written.join(', ')}. Other configuration files were not changed; review before retrying.`
      : ' No configuration files were changed.';
    vscodeApi.window.showErrorMessage(`Stem MCP setup failed: ${toErrorMessage(error)}${result}`);
  }
}

function readMcpConfig(filePath, fs) {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${filePath}: expected a regular configuration file; edit it manually.`);
    return { bytes: fs.readFileSync(filePath), mode: stat.mode & 0o777 };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`${filePath}: ${toErrorMessage(error)}`);
  }
}

function isMcpObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isGeneratedMcpEntry(entry, root, typed = false) {
  if (!isMcpObject(entry) || entry.cwd !== root) return false;
  const keys = typed ? ['args', 'command', 'cwd', 'type'] : ['args', 'command', 'cwd'];
  if (Object.keys(entry).sort().join(',') !== keys.join(',') || (typed && entry.type !== 'stdio')) return false;
  const expected = entry.command === 'stem' ? ['mcp']
    : entry.command === 'npx' ? ['-y', '@stemdev/cli@latest', 'mcp'] : null;
  return expected !== null && Array.isArray(entry.args) &&
    entry.args.length === expected.length && entry.args.every((arg, index) => arg === expected[index]);
}

function prepareMcpConfig(filePath, serverKey, stemEntry, fs) {
  const original = readMcpConfig(filePath, fs);
  const text = original?.bytes.toString('utf8') ?? '';
  let config = {};
  if (text.trim()) {
    try { config = JSON.parse(text); } catch {
      throw new Error(`${filePath}: automatic setup accepts ordinary JSON only. Invalid JSON and JSONC (comments/trailing commas) are left untouched. Edit ${serverKey}.stem manually; see the extension's MCP setup guide.`);
    }
  }
  if (!isMcpObject(config)) throw new Error(`${filePath}: the configuration must be an object.`);
  for (const key of serverKey === 'servers' ? ['servers', 'mcpServers'] : ['mcpServers']) {
    if (Object.hasOwn(config, key) && !isMcpObject(config[key])) throw new Error(`${filePath}: ${key} must be an object.`);
  }
  const before = JSON.stringify(config);
  let entry = config[serverKey]?.stem;
  if (serverKey === 'servers' && Object.hasOwn(config.mcpServers ?? {}, 'stem')) {
    const legacy = config.mcpServers.stem;
    const same = candidate => (isGeneratedMcpEntry(candidate, stemEntry.cwd) || isGeneratedMcpEntry(candidate, stemEntry.cwd, true)) &&
      candidate.command === legacy.command && JSON.stringify(candidate.args) === JSON.stringify(legacy.args);
    if (!isGeneratedMcpEntry(legacy, stemEntry.cwd) || (Object.hasOwn(config.servers ?? {}, 'stem') && !same(entry))) {
      throw new Error(`${filePath}: customized or conflicting mcpServers.stem; merge it into servers.stem manually. No legacy entry was removed.`);
    }
    entry = { ...legacy, type: 'stdio' };
    delete config.mcpServers.stem;
    if (!Object.keys(config.mcpServers).length) delete config.mcpServers;
  } else if (Object.hasOwn(config[serverKey] ?? {}, 'stem')) {
    const remote = isMcpObject(entry) && typeof entry.url === 'string' && entry.url.trim();
    const validTransport = remote ? entry.type === undefined || ['http', 'sse'].includes(entry.type)
      : entry?.type === undefined || entry.type === 'stdio';
    if (!isMcpObject(entry) || !validTransport || (Object.hasOwn(entry, 'url') && !remote) ||
      (!remote && (typeof entry.command !== 'string' || !entry.command.trim())) ||
      (entry.args !== undefined && (!Array.isArray(entry.args) || entry.args.some(arg => typeof arg !== 'string'))) ||
      (entry.cwd !== undefined && typeof entry.cwd !== 'string') || (entry.envFile !== undefined && typeof entry.envFile !== 'string') ||
      (entry.env !== undefined && (!isMcpObject(entry.env) || Object.values(entry.env).some(value => value !== null && !['string', 'number'].includes(typeof value))))) {
      throw new Error(`${filePath}: ${serverKey}.stem has an invalid shape; review it manually.`);
    }
    if (!remote && entry.type === undefined) entry = { ...entry, type: 'stdio' };
  } else {
    entry = { ...stemEntry };
  }
  config[serverKey] = { ...config[serverKey], stem: entry };
  return {
    filePath, original,
    output: before === JSON.stringify(config) ? null : JSON.stringify(config, null, 2) + '\n',
    hasLegacyServers: serverKey === 'servers' && Object.hasOwn(config, 'mcpServers')
  };
}

function checkMcpConfigUnchanged(plan, vscodeApi, fs) {
  if (vscodeApi.workspace.textDocuments?.some(doc => doc.isDirty && path.resolve(doc.uri.fsPath) === path.resolve(plan.filePath))) {
    throw new Error(`${plan.filePath}: save or close the unsaved configuration before retrying.`);
  }
  const current = readMcpConfig(plan.filePath, fs);
  if (plan.original === null ? current !== null : current === null || !plan.original.bytes.equals(current.bytes)) {
    throw new Error(`${plan.filePath}: configuration changed during setup; retry after reviewing it.`);
  }
}

function writeMcpConfigs(plans, vscodeApi, fs, written) {
  const staged = [];
  try {
    for (const plan of plans) checkMcpConfigUnchanged(plan, vscodeApi, fs);
    for (const plan of plans.filter(plan => plan.output !== null)) {
      fs.mkdirSync(path.dirname(plan.filePath), { recursive: true });
      const tempPath = `${plan.filePath}.${require('node:crypto').randomUUID()}.tmp`;
      const fd = fs.openSync(tempPath, 'wx', plan.original?.mode ?? 0o600);
      staged.push({ plan, tempPath });
      try {
        fs.writeFileSync(fd, plan.output, 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    }
    for (const plan of plans) checkMcpConfigUnchanged(plan, vscodeApi, fs);
    for (const { plan, tempPath } of staged) {
      checkMcpConfigUnchanged(plan, vscodeApi, fs);
      if (plan.original === null) {
        // Publish missing files without clobbering a concurrent creator.
        fs.linkSync(tempPath, plan.filePath);
      } else {
        fs.renameSync(tempPath, plan.filePath);
      }
      written.push(plan.filePath);
    }
  } finally {
    for (const { tempPath } of staged) {
      try { fs.unlinkSync(tempPath); } catch (error) {
        if (error.code !== 'ENOENT') console.error(`Stem: could not remove staged configuration ${tempPath}`, error);
      }
    }
  }
}

function deactivate() {}

class StemPreviewProvider {
  constructor(context, vscodeApi = vscode) {
    this.context = context;
    this.vscode = vscodeApi;
    this.emitter = new this.vscode.EventEmitter();
    this.onDidChange = this.emitter.event;
    this.openPreviewUrisByProject = new Map();
    this.jobs = new Map();
    this.lastContent = new Map();
  }

  async provideTextDocumentContent(uri, token) {
    const key = uri.toString();
    this.jobs.get(key)?.controller.abort();
    const controller = new AbortController();
    const cancellation = token?.onCancellationRequested(() => controller.abort());
    if (token?.isCancellationRequested) controller.abort();
    const job = { controller, promise: null };
    this.jobs.set(key, job);
    job.promise = renderPreview(uri, this.vscode, controller.signal).then((content) => {
      controller.signal.throwIfAborted();
      if (!controller.signal.aborted && this.jobs.get(key) === job) this.lastContent.set(key, content);
      return content;
    }).catch((error) => {
      if (!controller.signal.aborted) throw error;
      const latest = this.jobs.get(key);
      return latest && latest !== job ? latest.promise : this.lastContent.get(key) ?? '';
    }).finally(() => cancellation?.dispose());
    return job.promise;
  }

  cancelProject(projectRoot) {
    for (const key of this.openPreviewUrisByProject.get(projectRoot) ?? []) this.jobs.get(key)?.controller.abort();
  }

  dispose() {
    for (const job of this.jobs.values()) job.controller.abort();
    this.jobs.clear();
    this.lastContent.clear();
    this.openPreviewUrisByProject.clear();
    this.emitter.dispose();
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
    const key = uri.toString();
    this.jobs.get(key)?.controller.abort();
    this.jobs.delete(key);
    this.lastContent.delete(key);
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
    this.getWatchPatterns = options.getWatchPatterns ?? (() => WATCH_PATTERNS);
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.watchersByProject = new Map();
    this.refreshTimers = new Map();
  }

  watchProject(projectRoot) {
    if (!this.isAutoRefreshEnabled() || this.watchersByProject.has(projectRoot)) {
      return;
    }

    const disposables = this.getWatchPatterns(projectRoot).map((pattern) => {
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
    if (!this.isAutoRefreshEnabled() || (this.provider.hasProject && !this.provider.hasProject(projectRoot))) {
      return;
    }
    this.provider.cancelProject?.(projectRoot);

    const existingTimer = this.refreshTimers.get(projectRoot);
    if (existingTimer !== undefined) {
      this.clearTimer(existingTimer);
    }

    const timer = this.setTimer(() => {
      this.refreshTimers.delete(projectRoot);
      if (!this.provider.hasProject || this.provider.hasProject(projectRoot)) this.provider.refreshProject(projectRoot);
    }, this.getRefreshDebounceMs());
    this.refreshTimers.set(projectRoot, timer);
  }

  documentChanged(document) {
    for (const projectRoot of this.provider.getTrackedProjects()) {
      if (isInProject(projectRoot, document.uri)) this.scheduleRefresh(projectRoot);
    }
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
    vscodeApi.window.showWarningMessage('Stem preview is disabled in untrusted workspaces.');
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

  const projectRoot = await findProjectRootAsync(vscodeApi.workspace.fs ? vscodeApi : vscode, document.uri);
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

async function renderPreview(uri, vscodeApi = vscode, signal) {
  const params = parsePreviewUri(uri);
  if (params === null) {
    return formatPreviewError(new Error('Stem preview could not resolve the requested view.'), {
      nextAction: 'Close this preview and open it again from a Stem view Markdown file.'
    });
  }

  try {
    if (params.source !== null && vscodeApi.Uri.parse(params.source).scheme !== 'file') {
      throw new Error('Stem preview is available for Markdown files on disk.');
    }
    return await renderProjectPreview(vscodeApi, vscodeApi.Uri.file(params.projectRoot), params.viewId, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    const details = toPreviewErrorDetails(error);
    return formatPreviewError(error, {
      viewId: params.viewId,
      projectRoot: params.projectRoot,
      nextAction: getPreviewFailureNextAction(details)
    });
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

  // Windows npm global installs create `.cmd` wrappers which require a shell.
  if (process.platform === 'win32' && (command === 'stem' || command.toLowerCase().endsWith('.cmd') || command.toLowerCase().endsWith('.bat'))) {
    options.shell = true;
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

  const executableName = path.win32.basename(nodePath).toLowerCase();
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

function getConfiguredCliPath(vscodeApi = vscode) {
  return vscodeApi.workspace.getConfiguration('stem').get('cliPath', '').trim();
}

function isAutoRefreshEnabled() {
  return vscode.workspace.getConfiguration('stem').get('preview.autoRefresh', true);
}

function getRefreshDebounceMs(vscodeApi = vscode) {
  const configured = vscodeApi.workspace.getConfiguration('stem').get('preview.refreshDebounceMs', DEFAULT_REFRESH_DEBOUNCE_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_REFRESH_DEBOUNCE_MS;
}

function assertVscode(vscodeApi = vscode) {
  if (vscodeApi === null) {
    throw new Error('The Stem VS Code extension must be activated inside the VS Code extension host.');
  }
}

module.exports = {
  activate,
  deactivate,
  _private: {
    StemPreviewProvider,
    renderPreview,
    loadProjectSnapshot,
    renderProjectPreview,
    relativePath,
    DEFAULT_REFRESH_DEBOUNCE_MS,
    PREVIEW_SCHEME,
    PREVIEW_EXEC_MAX_BUFFER_BYTES,
    StemPreviewWatcherManager,
    WATCH_PATTERNS,
    registerMcpCommand,
    assertVscode,
    createPreviewUri,
    createPreviewUriText,
    findProjectRoot,
    findNodeOnPath,
    formatPreviewError,
    formatCommandText,
    getConfiguredCliPath,
    getRefreshDebounceMs,
    getPreviewExecOptions,
    getPreviewFailureNextAction,
    getFrontmatterId,
    isElectronBackedNodePath,
    openPreviewToSide,
    parsePreviewUri,
    quoteCommandPart,
    resolveNodeRuntime,
    resolveStemCommand,
    shouldRunElectronAsNode,
    stripLeadingFrontmatter,
    toPreviewDisplayMarkdown,
    toPreviewErrorDetails,
    toErrorMessage
  }
};
