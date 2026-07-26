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
    WATCH_PATTERNS: string[];
    createPreviewUriText(projectRoot: string, viewId: string, sourceUriText: string): string;
    findProjectRoot(startDir: string): string | null;
    formatPreviewError(error: unknown): string;
    getFrontmatterId(content: string): string | null;
    parsePreviewUri(uri: { query: string }): { projectRoot: string; viewId: string; source: string | null } | null;
    resolveStemCommand(options: {
      configuredCliPath: string;
      projectRoot: string;
      extensionRoot: string;
      pathExists(filePath: string): boolean;
      nodePath: string;
    }): { command: string; args: string[] };
    toErrorMessage(error: unknown): string;
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
    const sourceUri = 'file:///workspace/views/api.md';
    const uriText = stem.createPreviewUriText('C:\\repo with spaces\\stem', 'api-view', sourceUri);
    const parsed = stem.parsePreviewUri({ query: uriText.slice(uriText.indexOf('?') + 1) });

    expect(uriText.startsWith(`${stem.PREVIEW_SCHEME}:/api-view.md?`)).toBe(true);
    expect(parsed).toEqual({
      projectRoot: 'C:\\repo with spaces\\stem',
      viewId: 'api-view',
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

  it('formats preview errors as Markdown with stderr detail', () => {
    const error = new Error('Command failed') as Error & { stderr: string };
    error.stderr = 'Broken block reference';

    expect(stem.formatPreviewError(error)).toBe(
      '# Stem Preview Error\n\n```text\nCommand failed\nBroken block reference\n```\n'
    );
    expect(stem.toErrorMessage('plain failure')).toBe('plain failure');
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
