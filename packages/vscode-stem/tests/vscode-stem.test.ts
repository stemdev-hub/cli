import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const extensionModule = require('../dist/extension.js') as StemExtensionModule;
const stem = extensionModule._private;

interface StemExtensionModule {
  activate(context: unknown): void;
  _private: {
    registerMcpCommand(context: unknown, vscodeApi: McpTestApi, options: McpTestOptions): { dispose(): void };
    DEFAULT_REFRESH_DEBOUNCE_MS: number;
    PREVIEW_SCHEME: string;
    PREVIEW_EXEC_MAX_BUFFER_BYTES: number;
    StemPreviewWatcherManager: new (
      provider: {
        getTrackedProjects(): string[];
        refreshProject(projectRoot: string): void;
      },
      options: {
        vscodeApi: FakeVscodeApi;
        isAutoRefreshEnabled(): boolean;
        getRefreshDebounceMs(): number;
        setTimer(callback: () => void, ms: number): FakeTimer;
        clearTimer(timer: FakeTimer): void;
      }
    ) => {
      watchProject(projectRoot: string): void;
      unwatchProject(projectRoot: string): void;
      applyConfiguration(): void;
      scheduleRefresh(projectRoot: string): void;
      dispose(): void;
    };
    WATCH_PATTERNS: string[];
    createPreviewUri(
      projectRoot: string,
      viewId: string,
      sourceUri: { toString(skipEncoding?: boolean): string },
      vscodeApi: { Uri: { parse(uriText: string): { query: string; toString(): string } } }
    ): { query: string; toString(): string };
    createPreviewUriText(projectRoot: string, viewId: string, sourceUriText: string): string;
    findProjectRoot(startDir: string): string | null;
    findNodeOnPath(env: Record<string, string | undefined>, pathExists: (filePath: string) => boolean): string | null;
    formatCommandText(command: string, args: string[]): string;
    getConfiguredCliPath(vscodeApi: unknown): string;
    getRefreshDebounceMs(vscodeApi: unknown): number;
    formatPreviewError(error: unknown, options?: { viewId?: string; projectRoot?: string; nextAction?: string }): string;
    getPreviewExecOptions(options: {
      command: string;
      args: string[];
      cwd: string;
      nodePath: string;
      env: Record<string, string | undefined>;
      runtimeVersions: { electron?: string };
    }): { cwd: string; maxBuffer: number; env?: Record<string, string | undefined> };
    getPreviewFailureNextAction(details: {
      message: string;
      exitCode: number | string | null;
      stderr: string;
      stdout: string;
      commandText: string | null;
      cwd: string | null;
    }): string;
    getFrontmatterId(content: string): string | null;
    isElectronBackedNodePath(nodePath: string, runtimeVersions: { electron?: string }): boolean;
    openPreviewToSide(
      provider: {
        track(uri: { query: string; toString(): string }): void;
        untrack(uri: { query: string; toString(): string }): string | null;
        hasProject(projectRoot: string): boolean;
      },
      watchers: {
        watchProject(projectRoot: string): void;
        unwatchProject(projectRoot: string): void;
      },
      vscodeApi: OpenPreviewFakeVscodeApi
    ): Promise<void>;
    parsePreviewUri(uri: { query: string }): { projectRoot: string; viewId: string; source: string | null } | null;
    quoteCommandPart(part: string): string;
    resolveStemCommand(options: {
      configuredCliPath: string;
      projectRoot: string;
      extensionRoot: string;
      pathExists(filePath: string): boolean;
      nodePath: string;
      env?: Record<string, string | undefined>;
      runtimeVersions?: { electron?: string };
    }): { command: string; args: string[] };
    resolveNodeRuntime(options: {
      nodePath: string;
      env: Record<string, string | undefined>;
      pathExists(filePath: string): boolean;
      runtimeVersions?: { electron?: string };
    }): string;
    shouldRunElectronAsNode(options: {
      command: string;
      args: string[];
      nodePath: string;
      runtimeVersions: { electron?: string };
    }): boolean;
    stripLeadingFrontmatter(markdown: string): string;
    toPreviewDisplayMarkdown(markdown: string): string;
    toErrorMessage(error: unknown): string;
    toPreviewErrorDetails(error: unknown): {
      message: string;
      stderr: string;
      stdout: string;
      exitCode: number | string | null;
      commandText: string | null;
      cwd: string | null;
    };
  };
}

interface McpTestApi {
  workspace: {
    isTrusted: boolean;
    workspaceFolders: Array<{ uri: { fsPath: string } }>;
    textDocuments: Array<{ uri: { fsPath: string }; isDirty: boolean }>;
  };
  window: {
    showInformationMessage(this: void, message: string): void;
    showWarningMessage(this: void, message: string): void;
    showErrorMessage(this: void, message: string): void;
  };
  commands: { registerCommand(this: void, id: string, callback: () => Promise<void>): { dispose(): void } };
}

interface McpTestOptions {
  fs: typeof fs;
  execFile(this: void, command: string, args: string[], options: { timeout: number }, callback: (error: Error | null) => void): void;
}

interface McpTestConfig {
  servers?: Record<string, Record<string, unknown>>;
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

interface FakeTimer {
  callback: () => void;
  ms: number;
  cleared: boolean;
}

interface FakeWatcher {
  basePath: string;
  pattern: string;
  disposed: boolean;
  changeCallbacks: Array<() => void>;
  createCallbacks: Array<() => void>;
  deleteCallbacks: Array<() => void>;
  onDidChange(callback: () => void): { dispose(): void };
  onDidCreate(callback: () => void): { dispose(): void };
  onDidDelete(callback: () => void): { dispose(): void };
  dispose(): void;
}

interface FakeVscodeApi {
  Uri: {
    file(filePath: string): { fsPath: string };
  };
  RelativePattern: new (base: { fsPath: string }, pattern: string) => { base: { fsPath: string }; pattern: string };
  workspace: {
    createFileSystemWatcher(pattern: { base: { fsPath: string }; pattern: string }): FakeWatcher;
  };
}

interface OpenPreviewFakeVscodeApi {
  Uri: {
    parse(uriText: string): { query: string; toString(): string };
  };
  commands: {
    executeCommand(command: string, uri: { query: string; toString(): string }): Promise<void>;
  };
  window: {
    activeTextEditor?: {
      document: {
        uri: { scheme: string; fsPath: string; toString(skipEncoding?: boolean): string };
        languageId: string;
        getText(): string;
      };
    };
    showInformationMessage(message: string): void;
    showWarningMessage(message: string): void;
  };
  workspace: {
    isTrusted?: boolean;
  };
}

describe('Stem MCP setup command', () => {
  let root: string;
  let api: McpTestApi;
  let options: McpTestOptions;
  let run: () => Promise<void>;
  const configPath = (host: string) => path.join(root, host, 'mcp.json');
  const put = async (host: string, text: string) => {
    await mkdir(path.join(root, host), { recursive: true });
    await writeFile(configPath(host), text);
  };
  const config = async (host: string) => JSON.parse(await readFile(configPath(host), 'utf8')) as McpTestConfig;
  const legacyEntry = (command = 'npx') => ({ command, args: command === 'stem' ? ['mcp'] : ['-y', '@stemdev/cli@latest', 'mcp'], cwd: root });
  const assertNoStagedFiles = async () => {
    for (const host of ['.cursor', '.vscode']) {
      if (fs.existsSync(path.join(root, host))) expect((await readdir(path.join(root, host))).filter(name => name.endsWith('.tmp'))).toEqual([]);
    }
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'stem-r02-'));
    api = {
      workspace: { isTrusted: true, workspaceFolders: [{ uri: { fsPath: root } }], textDocuments: [] },
      window: { showInformationMessage: vi.fn(), showWarningMessage: vi.fn(), showErrorMessage: vi.fn() },
      commands: { registerCommand: vi.fn<McpTestApi['commands']['registerCommand']>((id, callback) => {
        expect(id).toBe('stem.enableMcp');
        run = callback;
        return { dispose() {} };
      }) }
    };
    options = { fs, execFile: vi.fn<McpTestOptions['execFile']>((_command, _args, _options, callback) => callback(new Error('not installed'))) };
    stem.registerMcpCommand({}, api, options);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each([false, true])('writes separate host envelopes with the unchanged discovery branch (probe succeeds: %s)', async success => {
    options.execFile = vi.fn<McpTestOptions['execFile']>((_command, _args, _options, callback) => callback(success ? null : new Error('not installed')));
    await run();
    expect(options.execFile).toHaveBeenCalledWith('stem', ['--version'], { timeout: 3000 }, expect.any(Function));
    const entry = { ...legacyEntry(success ? 'stem' : 'npx'), type: 'stdio' };
    expect(await config('.cursor')).toEqual({ mcpServers: { stem: entry } });
    expect(await config('.vscode')).toEqual({ servers: { stem: entry } });
    expect(api.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining(root));
    expect(api.window.showErrorMessage).not.toHaveBeenCalled();
    await assertNoStagedFiles();
  });

  it.each(['', '  \r\n\t'])('initializes empty configuration %j', async text => {
    await put('.cursor', text);
    await put('.vscode', text);
    await run();
    expect((await config('.vscode')).servers?.['stem']?.['type']).toBe('stdio');
    expect((await config('.cursor')).mcpServers?.['stem']?.['type']).toBe('stdio');
  });

  it('preserves unrelated keys and customized servers, including remote Stem entries', async () => {
    const cursor = { inputs: [{ id: 'secret' }], custom: { enabled: true }, mcpServers: { other: { command: 'other' }, stem: { type: 'stdio', command: 'custom', args: ['--custom'], cwd: '/custom', env: { TOKEN: '${env:TOKEN}' } } } };
    const vscode = { inputs: [{ id: 'secret' }], servers: { other: { command: 'other' }, stem: { type: 'http', url: 'https://example.test/mcp', headers: { Authorization: '${input:secret}' } } } };
    await put('.cursor', JSON.stringify(cursor));
    await put('.vscode', JSON.stringify(vscode));
    options.fs = { ...fs, openSync: vi.fn(fs.openSync) };
    await run();
    expect(await config('.cursor')).toEqual(cursor);
    expect(await config('.vscode')).toEqual(vscode);
    expect(options.fs.openSync).not.toHaveBeenCalled();
    expect(api.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('already configured'));
  });

  it('adds only the missing stdio type to a customized entry', async () => {
    const custom = { command: 'node', args: ['custom.js'], env: { CUSTOM: 'yes' }, cwd: '/custom', dev: { watch: '*.js' } };
    await put('.vscode', JSON.stringify({ servers: { stem: custom }, inputs: [] }));
    await run();
    expect((await config('.vscode')).servers?.['stem']).toEqual({ ...custom, type: 'stdio' });
  });

  it('does not rewrite configurations on repeated setup', async () => {
    await run();
    const original = await readFile(configPath('.vscode'));
    options.fs = { ...fs, openSync: vi.fn(fs.openSync), renameSync: vi.fn(fs.renameSync), linkSync: vi.fn(fs.linkSync) };
    await run();
    expect(await readFile(configPath('.vscode'))).toEqual(original);
    expect(options.fs.openSync).not.toHaveBeenCalled();
    expect(options.fs.renameSync).not.toHaveBeenCalled();
    expect(options.fs.linkSync).not.toHaveBeenCalled();
  });

  it.each([
    '{ broken', '{ // valid JSONC\n "servers": {},\n}', 'null', '[]', '42', '"text"',
    '{"servers":null}', '{"servers":[]}', '{"servers":"bad"}', '{"mcpServers":null}',
    '{"servers":{"stem":null}}', '{"servers":{"stem":[]}}', '{"servers":{"stem":{}}}',
    '{"servers":{"stem":{"command":"node","args":"bad"}}}',
    '{"servers":{"stem":{"command":"node","type":"http"}}}',
    '{"servers":{"stem":{"command":"node","env":[]}}}'
  ])('leaves both files unchanged for unsupported VS Code content %j', async text => {
    await put('.vscode', text);
    const cursor = '{"mcpServers":{"other":{"command":"other"}}}';
    await put('.cursor', cursor);
    await run();
    expect(await readFile(configPath('.vscode'), 'utf8')).toBe(text);
    expect(await readFile(configPath('.cursor'), 'utf8')).toBe(cursor);
    expect(api.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining(configPath('.vscode')));
    expect(api.window.showInformationMessage).not.toHaveBeenCalled();
    await assertNoStagedFiles();
  });

  it.each(['{"mcpServers":[]}', '{"mcpServers":{"stem":null}}', '{ // comment\n}'])('refuses unsafe Cursor content %j without creating the other file', async text => {
    await put('.cursor', text);
    await run();
    expect(await readFile(configPath('.cursor'), 'utf8')).toBe(text);
    expect(fs.existsSync(configPath('.vscode'))).toBe(false);
    expect(api.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining(configPath('.cursor')));
  });

  it.each(['npx', 'stem'])('repairs only recognizable legacy %s output during invoked setup', async command => {
    const entry = legacyEntry(command);
    await put('.vscode', JSON.stringify({ inputs: [], mcpServers: { stem: entry } }));
    await run();
    expect(await config('.vscode')).toEqual({ inputs: [], servers: { stem: { ...entry, type: 'stdio' } } });
  });

  it('preserves unrelated legacy entries and reports their manual review', async () => {
    await put('.vscode', JSON.stringify({ mcpServers: { stem: legacyEntry(), other: { command: 'other' } }, servers: { otherCurrent: { command: 'current' } } }));
    await run();
    expect((await config('.vscode')).mcpServers).toEqual({ other: { command: 'other' } });
    expect((await config('.vscode')).servers?.['otherCurrent']).toEqual({ command: 'current' });
    expect(api.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('merge those manually'));
  });

  it('removes a recognizable duplicate when the current entry matches it', async () => {
    const entry = legacyEntry();
    await put('.vscode', JSON.stringify({ servers: { stem: { ...entry, type: 'stdio' } }, mcpServers: { stem: entry } }));
    await run();
    expect((await config('.vscode')).mcpServers).toBeUndefined();
    expect((await config('.vscode')).servers?.['stem']).toEqual({ ...entry, type: 'stdio' });
  });

  it.each(['customized', 'conflicting', 'other-root'])('does not repair ambiguous legacy entries: %s', async kind => {
    const old = kind === 'customized' ? { ...legacyEntry(), env: { CUSTOM: 'yes' } }
      : kind === 'other-root' ? { ...legacyEntry(), cwd: '/other' } : legacyEntry();
    const text = JSON.stringify({ mcpServers: { stem: old }, ...(kind === 'conflicting' ? { servers: { stem: { command: 'custom' } } } : {}) });
    await put('.vscode', text);
    await run();
    expect(await readFile(configPath('.vscode'), 'utf8')).toBe(text);
    expect(fs.existsSync(configPath('.cursor'))).toBe(false);
    expect(api.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('merge it into servers.stem manually'));
  });

  it('refuses setup in untrusted or absent workspaces before probing or writing', async () => {
    api.workspace.isTrusted = false;
    await run();
    expect(api.window.showWarningMessage).toHaveBeenCalled();
    api.workspace.isTrusted = true;
    api.workspace.workspaceFolders = [];
    await run();
    expect(api.window.showErrorMessage).toHaveBeenCalledWith('No workspace folder open.');
    expect(options.execFile).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual([]);
  });

  it('targets only the first workspace folder', async () => {
    const second = path.join(root, 'second');
    await mkdir(second);
    api.workspace.workspaceFolders.push({ uri: { fsPath: second } });
    await run();
    expect(await readdir(second)).toEqual([]);
    expect((await config('.vscode')).servers?.['stem']?.['cwd']).toBe(root);
  });

  it('preserves both files when a configuration has unsaved editor changes', async () => {
    await put('.vscode', '{}');
    api.workspace.textDocuments.push({ uri: { fsPath: configPath('.vscode') }, isDirty: true });
    await run();
    expect(await readFile(configPath('.vscode'), 'utf8')).toBe('{}');
    expect(fs.existsSync(configPath('.cursor'))).toBe(false);
    expect(api.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('unsaved configuration'));
  });

  it('reports read failures without overwriting the file', async () => {
    await put('.vscode', '{}');
    options.fs = { ...fs, readFileSync: () => { throw new Error('EACCES fixture read denied'); } };
    await run();
    expect(await readFile(configPath('.vscode'), 'utf8')).toBe('{}');
    expect(fs.existsSync(configPath('.cursor'))).toBe(false);
    expect(api.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('EACCES'));
  });

  it.each(['open', 'write', 'rename'])('keeps originals intact on %s failure and cleans staged files', async operation => {
    await put('.cursor', '{}');
    await put('.vscode', '{}');
    const fail = () => { throw new Error(`fixture ${operation} denied`); };
    options.fs = { ...fs,
      ...(operation === 'open' ? { openSync: fail } : {}),
      ...(operation === 'write' ? { writeFileSync: fail } : {}),
      ...(operation === 'rename' ? { renameSync: fail } : {})
    };
    await run();
    for (const host of ['.cursor', '.vscode']) expect(await readFile(configPath(host), 'utf8')).toBe('{}');
    expect(api.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('No configuration files were changed'));
    await assertNoStagedFiles();
  });

  it('reports the exact partial outcome if the second replacement fails', async () => {
    await put('.cursor', '{}');
    await put('.vscode', '{}');
    options.fs = { ...fs, renameSync: (oldPath, newPath) => {
      if (newPath === configPath('.vscode')) throw new Error('fixture second rename denied');
      fs.renameSync(oldPath, newPath);
    } };
    await run();
    expect((await config('.cursor')).mcpServers?.['stem']?.['type']).toBe('stdio');
    expect(await readFile(configPath('.vscode'), 'utf8')).toBe('{}');
    expect(api.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining(`Updated only: ${configPath('.cursor')}`));
    expect(api.window.showInformationMessage).not.toHaveBeenCalled();
    await assertNoStagedFiles();
  });

  it('detects concurrent edits before committing either file', async () => {
    await put('.vscode', '{}');
    options.fs = { ...fs, fsyncSync: fd => {
      fs.fsyncSync(fd);
      fs.writeFileSync(configPath('.vscode'), '{"concurrent":true}');
    } };
    await run();
    expect(await readFile(configPath('.vscode'), 'utf8')).toBe('{"concurrent":true}');
    expect(fs.existsSync(configPath('.cursor'))).toBe(false);
    expect(api.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('changed during setup'));
    await assertNoStagedFiles();
  });

  it('does not clobber a concurrent creator of a previously missing file', async () => {
    options.fs = { ...fs, linkSync: (existingPath, newPath) => {
      fs.writeFileSync(newPath, '{"concurrent":true}');
      fs.linkSync(existingPath, newPath);
    } };
    await run();
    expect(await readFile(configPath('.cursor'), 'utf8')).toBe('{"concurrent":true}');
    expect(fs.existsSync(configPath('.vscode'))).toBe(false);
    expect(api.window.showErrorMessage).toHaveBeenCalled();
    await assertNoStagedFiles();
  });

  it('does not migrate existing configuration during activation', async () => {
    await mkdir(path.join(root, '.stem'));
    await writeFile(path.join(root, '.stem', 'config.json'), '{}');
    const text = JSON.stringify({ mcpServers: { stem: legacyEntry() } });
    await put('.vscode', text);
    const mock = require('vscode') as Record<string, unknown>;
    const original = { ...mock };
    const disposable = () => ({ dispose() {} });
    const subscriptions: Array<{ dispose(): void }> = [];
    Object.assign(mock, {
      EventEmitter: class { event = () => {}; dispose() {} },
      window: api.window,
      commands: { registerCommand: vi.fn(disposable) },
      workspace: { ...api.workspace, registerTextDocumentContentProvider: disposable, onDidChangeTextDocument: disposable, onDidCloseTextDocument: disposable, onDidChangeConfiguration: disposable }
    });
    try {
      extensionModule.activate({ subscriptions, globalState: { get: () => false }, workspaceState: { get: () => false } });
      await Promise.resolve();
      expect(await readFile(configPath('.vscode'), 'utf8')).toBe(text);
      expect(fs.existsSync(configPath('.cursor'))).toBe(false);
      expect(api.window.showInformationMessage).not.toHaveBeenCalled();
      expect((mock['commands'] as { registerCommand: unknown }).registerCommand).toHaveBeenCalledWith('stem.enableMcp', expect.any(Function));
    } finally {
      subscriptions.forEach(subscription => subscription.dispose());
      for (const key of Object.keys(mock)) delete mock[key];
      Object.assign(mock, original);
    }
  });
});

describe('VS Code Stem extension helpers', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-vscode-extension-'));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('extracts frontmatter ids from Markdown documents', () => {
    expect(stem.getFrontmatterId('---\nid: api-view\n---\n# API\n')).toBe('api-view');
    expect(stem.getFrontmatterId('---\nid: "api_view-1"\n---\n')).toBe('api_view-1');
    expect(stem.getFrontmatterId("---\nid: 'api.view with spaces'\n---\n")).toBe('api.view with spaces');
    expect(stem.getFrontmatterId('---\nid: api-view # primary API view\n---\n')).toBe('api-view');
    expect(stem.getFrontmatterId('# No frontmatter\n')).toBeNull();
    expect(stem.getFrontmatterId('---\ntitle: API\n---\n')).toBeNull();
  });

  it('finds the nearest Stem project root', async () => {
    const nestedDir = path.join(testRoot, 'views/backend');
    await mkdir(path.join(testRoot, '.stem'), { recursive: true });
    await mkdir(nestedDir, { recursive: true });

    expect(stem.findProjectRoot(nestedDir)).toBe(testRoot);
    expect(stem.findProjectRoot(tmpdir())).toBeNull();
  });

  it('round-trips preview URI query data', () => {
    const sourceUri = 'file:///C:/repo%20with%20spaces/views/api%20guide.md';
    const uriText = stem.createPreviewUriText('C:\\repo with spaces\\stem', 'api/view with spaces', sourceUri);
    const parsed = stem.parsePreviewUri({ query: uriText.slice(uriText.indexOf('?') + 1) });

    expect(uriText.startsWith(`${stem.PREVIEW_SCHEME}:/view/api%2Fview%20with%20spaces.md?`)).toBe(true);
    expect(parsed).toEqual({
      projectRoot: 'C:\\repo with spaces\\stem',
      viewId: 'api/view with spaces',
      source: sourceUri
    });
  });

  it('creates preview URIs without losing Windows paths with spaces', () => {
    const vscodeApi = {
      Uri: {
        parse: (uriText: string) => ({
          query: uriText.slice(uriText.indexOf('?') + 1),
          toString: () => uriText
        })
      }
    };
    const sourceUri = {
      toString: () => 'file:///C:/repo%20with%20spaces/views/api.md'
    };

    const uri = stem.createPreviewUri('C:\\repo with spaces\\stem', 'api-view', sourceUri, vscodeApi);

    expect(stem.parsePreviewUri(uri)).toEqual({
      projectRoot: 'C:\\repo with spaces\\stem',
      viewId: 'api-view',
      source: 'file:///C:/repo%20with%20spaces/views/api.md'
    });
  });

  it('rejects incomplete preview URIs', () => {
    expect(stem.parsePreviewUri({ query: 'root=C%3A%5Crepo' })).toBeNull();
    expect(stem.parsePreviewUri({ query: 'view=api-view' })).toBeNull();
  });

  it('resolves Stem CLI commands in precedence order', () => {
    const nodePath = process.execPath;
    const projectRoot = path.join(testRoot, 'project');
    const extensionRoot = path.join(testRoot, 'extension');
    const workspaceCli = path.join(projectRoot, 'dist', 'cli', 'index.js');
    const bundledCli = path.resolve(extensionRoot, '..', '..', 'dist', 'cli', 'index.js');

    expect(
      stem.resolveStemCommand({
        configuredCliPath: ' C:\\tools\\stem.cmd ',
        projectRoot,
        extensionRoot,
        pathExists: () => true,
        nodePath,
        env: {}
      })
    ).toEqual({ command: 'C:\\tools\\stem.cmd', args: [] });

    expect(
      stem.resolveStemCommand({
        configuredCliPath: ' C:\\tools\\stem cli\\index.js ',
        projectRoot,
        extensionRoot,
        pathExists: () => true,
        nodePath,
        env: {}
      })
    ).toEqual({ command: nodePath, args: ['C:\\tools\\stem cli\\index.js'] });

    expect(
      stem.resolveStemCommand({
        configuredCliPath: '',
        projectRoot,
        extensionRoot,
        pathExists: (filePath) => filePath === workspaceCli,
        nodePath,
        env: {}
      })
    ).toEqual({ command: nodePath, args: [workspaceCli] });

    expect(
      stem.resolveStemCommand({
        configuredCliPath: '',
        projectRoot,
        extensionRoot,
        pathExists: (filePath) => filePath === bundledCli,
        nodePath,
        env: {}
      })
    ).toEqual({ command: nodePath, args: [bundledCli] });

    expect(
      stem.resolveStemCommand({
        configuredCliPath: '',
        projectRoot,
        extensionRoot,
        pathExists: () => false,
        nodePath,
        env: {}
      })
    ).toEqual({ command: 'stem', args: [] });
  });

  it('prefers a real Node runtime on PATH over launching JavaScript CLI files through Code.exe', () => {
    const codePath =
      process.platform === 'win32'
        ? 'C:\\Users\\Asus\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'
        : '/Applications/Visual Studio Code.app/Contents/MacOS/Electron';
    const nodeDir = path.join(testRoot, 'node-bin');
    const nodePath = path.join(nodeDir, process.platform === 'win32' ? 'node.exe' : 'node');
    const projectRoot = path.join(testRoot, 'project');
    const workspaceCli = path.join(projectRoot, 'dist', 'cli', 'index.js');
    const resolved = stem.resolveStemCommand({
      configuredCliPath: '',
      projectRoot,
      extensionRoot: 'C:\\extension',
      pathExists: (filePath) => filePath === workspaceCli || filePath === nodePath,
      nodePath: codePath,
      env: { PATH: nodeDir },
      runtimeVersions: { electron: '37.0.0' }
    });

    expect(resolved).toEqual({ command: nodePath, args: [workspaceCli] });
  });

  it('does not choose Windows command-script shims as the Node runtime for execFile', () => {
    const nodeDir = path.join(testRoot, 'node-bin');

    expect(
      stem.findNodeOnPath(
        { PATH: nodeDir },
        (filePath) =>
          filePath === path.join(nodeDir, 'node.cmd') || filePath === path.join(nodeDir, 'node.bat')
      )
    ).toBeNull();
  });

  it('runs JavaScript CLI entrypoints through Electron as Node only in Electron runtimes', () => {
    const nodePath = 'C:\\Program Files\\Microsoft VS Code\\Code.exe';
    const normalNodePath = 'C:\\Program Files\\nodejs\\node.exe';
    const jsCli = 'C:\\repo with spaces\\dist\\cli\\index.js';

    expect(
      stem.shouldRunElectronAsNode({
        command: nodePath,
        args: [jsCli, 'preview', 'view', 'api-view'],
        nodePath,
        runtimeVersions: { electron: '37.0.0' }
      })
    ).toBe(true);

    expect(
      stem.shouldRunElectronAsNode({
        command: normalNodePath,
        args: [jsCli, 'preview', 'view', 'api-view'],
        nodePath: normalNodePath,
        runtimeVersions: {}
      })
    ).toBe(false);
  });

  it('runs JavaScript CLI entrypoints through VS Code executable paths as Node mode', () => {
    const nodePath = 'C:\\Users\\Asus\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
    const cliPath = 'c:\\Users\\Asus\\Desktop\\aaa\\adil\\stem\\dist\\cli\\index.js';

    expect(stem.isElectronBackedNodePath(nodePath, {})).toBe(true);
    expect(
      stem.shouldRunElectronAsNode({
        command: nodePath,
        args: [cliPath, 'preview', 'view', 'bds-view'],
        nodePath,
        runtimeVersions: {}
      })
    ).toBe(true);
  });

  it('does not set Electron Node mode for native executables or stem on PATH', () => {
    const nodePath = 'C:\\Program Files\\Microsoft VS Code\\Code.exe';

    expect(
      stem.shouldRunElectronAsNode({
        command: 'C:\\tools\\stem.cmd',
        args: ['preview', 'view', 'api-view'],
        nodePath,
        runtimeVersions: { electron: '37.0.0' }
      })
    ).toBe(false);

    expect(
      stem.shouldRunElectronAsNode({
        command: 'stem',
        args: ['preview', 'view', 'api-view'],
        nodePath,
        runtimeVersions: { electron: '37.0.0' }
      })
    ).toBe(false);
  });

  it('builds preview exec options with Electron Node mode and a larger output buffer', () => {
    const env = { PATH: 'C:\\tools', STEM_TEST: 'true' };
    const options = stem.getPreviewExecOptions({
      command: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      args: ['C:\\repo\\dist\\cli\\index.js', 'preview', 'view', 'api-view'],
      cwd: 'C:\\repo',
      nodePath: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      env,
      runtimeVersions: { electron: '37.0.0' }
    });

    expect(options).toEqual({
      cwd: 'C:\\repo',
      maxBuffer: stem.PREVIEW_EXEC_MAX_BUFFER_BYTES,
      env: {
        PATH: 'C:\\tools',
        STEM_TEST: 'true',
        ELECTRON_RUN_AS_NODE: '1'
      }
    });
  });

  it('applies Electron Node mode to configured JavaScript CLI paths resolved through process.execPath', () => {
    const nodePath = 'C:\\Program Files\\Microsoft VS Code\\Code.exe';
    const configuredCliPath = 'C:\\tools\\stem cli\\index.mjs';
    const resolved = stem.resolveStemCommand({
      configuredCliPath,
      projectRoot: 'C:\\repo',
      extensionRoot: 'C:\\extension',
      pathExists: () => false,
      nodePath
    });
    const options = stem.getPreviewExecOptions({
      command: resolved.command,
      args: [...resolved.args, 'preview', 'view', 'api-view'],
      cwd: 'C:\\repo',
      nodePath,
      env: { PATH: 'C:\\tools' },
      runtimeVersions: { electron: '37.0.0' }
    });

    expect(resolved).toEqual({ command: nodePath, args: [configuredCliPath] });
    expect(options.env?.['ELECTRON_RUN_AS_NODE']).toBe('1');
  });

  it('applies Electron Node mode to workspace JavaScript CLI paths resolved through process.execPath', () => {
    const nodePath = 'C:\\Program Files\\Microsoft VS Code\\Code.exe';
    const projectRoot = path.join(testRoot, 'project');
    const workspaceCli = path.join(projectRoot, 'dist', 'cli', 'index.js');
    const resolved = stem.resolveStemCommand({
      configuredCliPath: '',
      projectRoot,
      extensionRoot: 'C:\\extension',
      pathExists: (filePath) => filePath === workspaceCli,
      nodePath
    });
    const options = stem.getPreviewExecOptions({
      command: resolved.command,
      args: [...resolved.args, 'preview', 'view', 'api-view'],
      cwd: projectRoot,
      nodePath,
      env: { PATH: 'C:\\tools' },
      runtimeVersions: { electron: '37.0.0' }
    });

    expect(resolved).toEqual({ command: nodePath, args: [workspaceCli] });
    expect(options.env?.['ELECTRON_RUN_AS_NODE']).toBe('1');
  });

  it('omits Electron Node mode from exec options outside Electron JS entrypoint execution', () => {
    const options = stem.getPreviewExecOptions({
      command: 'C:\\nodejs\\node.exe',
      args: ['C:\\repo\\dist\\cli\\index.js', 'preview', 'view', 'api-view'],
      cwd: 'C:\\repo',
      nodePath: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      env: { PATH: 'C:\\tools' },
      runtimeVersions: { electron: '37.0.0' }
    });

    expect(options).toEqual({
      cwd: 'C:\\repo',
      maxBuffer: stem.PREVIEW_EXEC_MAX_BUFFER_BYTES
    });
  });

  it('formats preview errors as Markdown with command details and next action', () => {
    const error = new Error('Command failed: noisy stack prefix\nat internal') as Error & {
      code: number;
      stderr: string;
      stdout: string;
      stemCommandText: string;
      stemCwd: string;
    };
    error.code = 1;
    error.stderr = 'Broken block reference';
    error.stdout = 'Checking project';
    error.stemCommandText = 'node dist/cli/index.js preview view api-view';
    error.stemCwd = 'C:\\repo';

    const markdown = stem.formatPreviewError(error, {
      viewId: 'api-view',
      projectRoot: 'C:\\repo',
      nextAction: 'Run `stem check`.'
    });

    expect(markdown).toContain('# Stem Preview Error');
    expect(markdown).toContain('Stem could not render `api-view`.');
    expect(markdown).toContain('## Command\n\n```text\nnode dist/cli/index.js preview view api-view\n```');
    expect(markdown).toContain('## Exit Code\n\n`1`');
    expect(markdown).toContain('## stderr\n\n```text\nBroken block reference\n```');
    expect(markdown).toContain('## stdout\n\n```text\nChecking project\n```');
    expect(markdown).toContain('## Summary\n\nCommand failed: noisy stack prefix');
    expect(markdown).toContain('## Next Action\n\nRun `stem check`.');
    expect(stem.toErrorMessage('plain failure')).toBe('plain failure');
  });

  it('suggests CLI setup when preview execution cannot find stem', () => {
    expect(
      stem.getPreviewFailureNextAction({
        message: 'spawn stem ENOENT',
        exitCode: 'ENOENT',
        stderr: '',
        stdout: '',
        commandText: 'stem preview view api-view',
        cwd: 'C:\\repo'
      })
    ).toContain('set `stem.cliPath`');
  });

  it('strips leading frontmatter from displayed preview Markdown only', () => {
    expect(stem.toPreviewDisplayMarkdown('---\nid: api-view\n---\n# API\n')).toBe('# API\n');
    expect(stem.stripLeadingFrontmatter('---\nid: api-view\n---')).toBe('');
    expect(stem.toPreviewDisplayMarkdown('# API\n\n---\nNot frontmatter\n')).toBe('# API\n\n---\nNot frontmatter\n');
  });

  it('extracts preview error details without folding stderr into the summary', () => {
    const error = new Error('spawn stem ENOENT') as Error & { code: string; cmd: string };
    error.code = 'ENOENT';
    error.cmd = 'stem preview view api-view';

    expect(stem.toPreviewErrorDetails(error)).toMatchObject({
      message: 'spawn stem ENOENT',
      stderr: '',
      exitCode: 'ENOENT',
      commandText: 'stem preview view api-view'
    });
  });

  it('quotes command text for display without changing execution arguments', () => {
    expect(stem.formatCommandText('C:\\Program Files\\node\\node.exe', ['C:\\repo with spaces\\dist\\cli\\index.js', 'preview'])).toBe(
      '"C:\\Program Files\\node\\node.exe" "C:\\repo with spaces\\dist\\cli\\index.js" preview'
    );
  });

  it('debounces project refreshes and replaces duplicate timers', () => {
    const fake = createFakeWatcherEnvironment();
    const refreshed: string[] = [];
    const manager = new stem.StemPreviewWatcherManager(
      {
        getTrackedProjects: () => [testRoot],
        refreshProject: (projectRoot) => refreshed.push(projectRoot)
      },
      fake.options
    );

    manager.watchProject(testRoot);
    manager.watchProject(testRoot);
    expect(fake.watchers).toHaveLength(stem.WATCH_PATTERNS.length);

    manager.scheduleRefresh(testRoot);
    const firstTimer = fake.timers[0];
    expect(firstTimer).toBeDefined();
    manager.scheduleRefresh(testRoot);
    expect(firstTimer?.cleared).toBe(true);
    expect(fake.timers[1]?.ms).toBe(25);

    fake.timers[1]?.callback();
    expect(refreshed).toEqual([testRoot]);
  });

  it('refreshes only the project whose watcher fired in a multi-root workspace', () => {
    const fake = createFakeWatcherEnvironment();
    const firstRoot = path.join(testRoot, 'first project');
    const secondRoot = path.join(testRoot, 'second project');
    const refreshed: string[] = [];
    const manager = new stem.StemPreviewWatcherManager(
      {
        getTrackedProjects: () => [firstRoot, secondRoot],
        refreshProject: (projectRoot) => refreshed.push(projectRoot)
      },
      fake.options
    );

    manager.watchProject(firstRoot);
    manager.watchProject(secondRoot);
    const secondProjectWatcher = fake.watchers.find((watcher) => watcher.basePath === secondRoot);
    secondProjectWatcher?.changeCallbacks[0]?.();

    expect(fake.timers).toHaveLength(1);
    fake.timers[0]?.callback();
    expect(refreshed).toEqual([secondRoot]);
  });

  it('does not execute the CLI in untrusted workspaces', async () => {
    const vscodeApi = createOpenPreviewFakeVscodeApi({ isTrusted: false });
    const tracked: string[] = [];
    const watched: string[] = [];

    await stem.openPreviewToSide(
      {
        track: (uri) => tracked.push(uri.toString()),
        untrack: () => null,
        hasProject: () => false
      },
      {
        watchProject: (projectRoot) => watched.push(projectRoot),
        unwatchProject: () => {}
      },
      vscodeApi
    );

    expect(vscodeApi.window.warningMessages).toEqual([
      'Stem preview is disabled in untrusted workspaces.'
    ]);
    expect(vscodeApi.commands.executedCommands).toEqual([]);
    expect(tracked).toEqual([]);
    expect(watched).toEqual([]);
  });

  it('cleans up tracking and watchers when native Markdown preview opening fails', async () => {
    const projectRoot = path.join(testRoot, 'project');
    const viewDir = path.join(projectRoot, 'views');
    await mkdir(path.join(projectRoot, '.stem'), { recursive: true });
    await mkdir(viewDir, { recursive: true });
    const vscodeApi = createOpenPreviewFakeVscodeApi({
      activeFilePath: path.join(viewDir, 'api.md'),
      commandError: new Error('preview command failed')
    });
    let trackedUri: { query: string; toString(): string } | null = null;
    const unwatched: string[] = [];

    await expect(
      stem.openPreviewToSide(
        {
          track: (uri) => {
            trackedUri = uri;
          },
          untrack: (uri) => {
            expect(uri).toBe(trackedUri);
            return projectRoot;
          },
          hasProject: () => false
        },
        {
          watchProject: () => {},
          unwatchProject: (root) => unwatched.push(root)
        },
        vscodeApi
      )
    ).rejects.toThrow('preview command failed');

    expect(unwatched).toEqual([projectRoot]);
  });

  describe('formatCommandText & quoteCommandPart', () => {
    it('quotes command parts that contain spaces', () => {
      expect(stem.formatCommandText('node', ['C:\\path with spaces\\index.js'])).toBe(
        'node "C:\\path with spaces\\index.js"'
      );
    });

    it('quotes command parts that contain double quotes', () => {
      expect(stem.formatCommandText('node', ['arg"with"quote'])).toBe(
        'node "arg\\"with\\"quote"'
      );
    });

    it('does not quote command parts that contain no spaces or quotes', () => {
      expect(stem.formatCommandText('stem', ['preview', 'view', 'api-view'])).toBe(
        'stem preview view api-view'
      );
    });
  });

  describe('Configuration Fallbacks', () => {
    it('falls back to DEFAULT_REFRESH_DEBOUNCE_MS when configured value is not a finite number', () => {
      const fakeVscode = {
        workspace: {
          getConfiguration: () => ({
            get: (key: string, defaultVal: number) => {
              if (key === 'preview.refreshDebounceMs') return NaN;
              return defaultVal;
            }
          })
        }
      };
      const result = stem.getRefreshDebounceMs(fakeVscode);
      expect(result).toBe(stem.DEFAULT_REFRESH_DEBOUNCE_MS);
    });

    it('falls back to DEFAULT_REFRESH_DEBOUNCE_MS when configured value is negative', () => {
      const fakeVscode = {
        workspace: {
          getConfiguration: () => ({
            get: (key: string, defaultVal: number) => {
              if (key === 'preview.refreshDebounceMs') return -1;
              return defaultVal;
            }
          })
        }
      };
      const result = stem.getRefreshDebounceMs(fakeVscode);
      expect(result).toBe(stem.DEFAULT_REFRESH_DEBOUNCE_MS);
    });
  });

  describe('StemPreviewWatcherManager', () => {
  it('applies auto-refresh configuration without leaving stale watchers or timers', () => {
    const fake = createFakeWatcherEnvironment();
    const manager = new stem.StemPreviewWatcherManager(
      {
        getTrackedProjects: () => [testRoot],
        refreshProject: () => {}
      },
      fake.options
    );

    manager.applyConfiguration();
    manager.scheduleRefresh(testRoot);
    expect(fake.watchers).toHaveLength(stem.WATCH_PATTERNS.length);

    fake.autoRefresh = false;
    manager.applyConfiguration();
    expect(fake.watchers.every((watcher) => watcher.disposed)).toBe(true);
    expect(fake.timers[0]?.cleared).toBe(true);

    fake.autoRefresh = true;
    manager.applyConfiguration();
    expect(fake.watchers.filter((watcher) => !watcher.disposed)).toHaveLength(stem.WATCH_PATTERNS.length);
  });

  it('disposes watchers for a project when the last preview closes', () => {
    const fake = createFakeWatcherEnvironment();
    const manager = new stem.StemPreviewWatcherManager(
      {
        getTrackedProjects: () => [],
        refreshProject: () => {}
      },
      fake.options
    );

    manager.watchProject(testRoot);
    manager.scheduleRefresh(testRoot);
    manager.unwatchProject(testRoot);

    expect(fake.watchers.every((watcher) => watcher.disposed)).toBe(true);
    expect(fake.timers[0]?.cleared).toBe(true);
  });

  it('keeps the expected watcher defaults public to the extension', () => {
    expect(stem.DEFAULT_REFRESH_DEBOUNCE_MS).toBe(250);
    expect(stem.WATCH_PATTERNS).toEqual([
      'views/**/*.md',
      'blocks/**/*.md',
      'blocks/schemas/**/*.{yaml,yml}',
      '.stem/config.json'
    ]);
  });
});

function createFakeWatcherEnvironment(): {
  autoRefresh: boolean;
  timers: FakeTimer[];
  watchers: FakeWatcher[];
  options: ConstructorParameters<StemExtensionModule['_private']['StemPreviewWatcherManager']>[1];
} {
  const state = {
    autoRefresh: true,
    timers: [] as FakeTimer[],
    watchers: [] as FakeWatcher[]
  };

  const vscodeApi: FakeVscodeApi = {
    Uri: {
      file: (filePath) => ({ fsPath: filePath })
    },
    RelativePattern: class {
      base: { fsPath: string };
      pattern: string;

      constructor(base: { fsPath: string }, pattern: string) {
        this.base = base;
        this.pattern = pattern;
      }
    },
    workspace: {
      createFileSystemWatcher: (pattern) => {
        const watcher: FakeWatcher = {
          basePath: pattern.base.fsPath,
          pattern: pattern.pattern,
          disposed: false,
          changeCallbacks: [],
          createCallbacks: [],
          deleteCallbacks: [],
          onDidChange: (callback) => {
            watcher.changeCallbacks.push(callback);
            return { dispose: () => {} };
          },
          onDidCreate: (callback) => {
            watcher.createCallbacks.push(callback);
            return { dispose: () => {} };
          },
          onDidDelete: (callback) => {
            watcher.deleteCallbacks.push(callback);
            return { dispose: () => {} };
          },
          dispose: () => {
            watcher.disposed = true;
          }
        };
        state.watchers.push(watcher);
        return watcher;
      }
    }
  };

  return {
    get autoRefresh() {
      return state.autoRefresh;
    },
    set autoRefresh(value: boolean) {
      state.autoRefresh = value;
    },
    timers: state.timers,
    watchers: state.watchers,
    options: {
      vscodeApi,
      isAutoRefreshEnabled: () => state.autoRefresh,
      getRefreshDebounceMs: () => 25,
      setTimer: (callback, ms) => {
        const timer = { callback, ms, cleared: false };
        state.timers.push(timer);
        return timer;
      },
      clearTimer: (timer) => {
        timer.cleared = true;
      }
    }
  };
}

function createOpenPreviewFakeVscodeApi(options: {
  isTrusted?: boolean;
  activeFilePath?: string;
  commandError?: Error;
}): OpenPreviewFakeVscodeApi & {
  commands: OpenPreviewFakeVscodeApi['commands'] & { executedCommands: string[] };
  window: OpenPreviewFakeVscodeApi['window'] & { informationMessages: string[]; warningMessages: string[] };
} {
  const executedCommands: string[] = [];
  const informationMessages: string[] = [];
  const warningMessages: string[] = [];
  const window: OpenPreviewFakeVscodeApi['window'] & { informationMessages: string[]; warningMessages: string[] } = {
    informationMessages,
    warningMessages,
    showInformationMessage: (message) => {
      informationMessages.push(message);
    },
    showWarningMessage: (message) => {
      warningMessages.push(message);
    }
  };

  if (options.activeFilePath !== undefined) {
    const activeFilePath = options.activeFilePath;
    window.activeTextEditor = {
      document: {
        uri: {
          scheme: 'file',
          fsPath: activeFilePath,
          toString: () => `file:///${activeFilePath.replaceAll('\\', '/')}`
        },
        languageId: 'markdown',
        getText: () => '---\nid: api-view\n---\n# API\n'
      }
    };
  }

  const workspace: OpenPreviewFakeVscodeApi['workspace'] = {};
  if (options.isTrusted !== undefined) {
    workspace.isTrusted = options.isTrusted;
  }

  return {
    Uri: {
      parse: (uriText) => ({
        query: uriText.slice(uriText.indexOf('?') + 1),
        toString: () => uriText
      })
    },
    commands: {
      executedCommands,
      executeCommand: async (command) => {
        executedCommands.push(command);
        if (options.commandError !== undefined) {
          throw options.commandError;
        }
      }
    },
    window,
    workspace
  };
}
});
