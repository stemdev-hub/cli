import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const extensionModule = require('../../extensions/vscode-stem/extension.js') as StemExtensionModule;
const stem = extensionModule._private;

interface StemExtensionModule {
  _private: {
    DEFAULT_REFRESH_DEBOUNCE_MS: number;
    PREVIEW_SCHEME: string;
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
    createPreviewUriText(projectRoot: string, viewId: string, sourceUriText: string): string;
    findProjectRoot(startDir: string): string | null;
    formatCommandText(command: string, args: string[]): string;
    formatPreviewError(error: unknown, options?: { viewId?: string; projectRoot?: string; nextAction?: string }): string;
    getFrontmatterId(content: string): string | null;
    parsePreviewUri(uri: { query: string }): { projectRoot: string; viewId: string; source: string | null } | null;
    resolveStemCommand(options: {
      configuredCliPath: string;
      projectRoot: string;
      extensionRoot: string;
      pathExists(filePath: string): boolean;
      nodePath: string;
    }): { command: string; args: string[] };
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

interface FakeTimer {
  callback: () => void;
  ms: number;
  cleared: boolean;
}

interface FakeWatcher {
  pattern: string;
  disposed: boolean;
  onDidChange(callback: () => void): void;
  onDidCreate(callback: () => void): void;
  onDidDelete(callback: () => void): void;
  dispose(): void;
}

interface FakeVscodeApi {
  Uri: {
    file(filePath: string): { fsPath: string };
  };
  RelativePattern: new (base: { fsPath: string }, pattern: string) => { base: { fsPath: string }; pattern: string };
  workspace: {
    createFileSystemWatcher(pattern: { pattern: string }): FakeWatcher;
  };
}

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
        nodePath
      })
    ).toEqual({ command: 'C:\\tools\\stem.cmd', args: [] });

    expect(
      stem.resolveStemCommand({
        configuredCliPath: ' C:\\tools\\stem cli\\index.js ',
        projectRoot,
        extensionRoot,
        pathExists: () => true,
        nodePath
      })
    ).toEqual({ command: nodePath, args: ['C:\\tools\\stem cli\\index.js'] });

    expect(
      stem.resolveStemCommand({
        configuredCliPath: '',
        projectRoot,
        extensionRoot,
        pathExists: (filePath) => filePath === workspaceCli,
        nodePath
      })
    ).toEqual({ command: nodePath, args: [workspaceCli] });

    expect(
      stem.resolveStemCommand({
        configuredCliPath: '',
        projectRoot,
        extensionRoot,
        pathExists: (filePath) => filePath === bundledCli,
        nodePath
      })
    ).toEqual({ command: nodePath, args: [bundledCli] });

    expect(
      stem.resolveStemCommand({
        configuredCliPath: '',
        projectRoot,
        extensionRoot,
        pathExists: () => false,
        nodePath
      })
    ).toEqual({ command: 'stem', args: [] });
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
          pattern: pattern.pattern,
          disposed: false,
          onDidChange: () => {},
          onDidCreate: () => {},
          onDidDelete: () => {},
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
