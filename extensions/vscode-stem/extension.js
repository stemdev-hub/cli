const { execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const vscode = require('vscode');

const execFileAsync = promisify(execFile);
const PREVIEW_SCHEME = 'stem-preview';

function activate(context) {
  const provider = new StemPreviewProvider(context);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, provider),
    vscode.commands.registerCommand('stem.previewToSide', async () => {
      await openPreviewToSide(provider);
    }),
    vscode.commands.registerCommand('stem.refreshPreview', () => {
      provider.refresh();
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isRelevantDocument(document)) {
        provider.refresh();
      }
    })
  );
}

function deactivate() {}

class StemPreviewProvider {
  constructor(context) {
    this.context = context;
    this.emitter = new vscode.EventEmitter();
    this.onDidChange = this.emitter.event;
    this.openPreviewUris = new Set();
  }

  provideTextDocumentContent(uri) {
    return renderPreview(uri, this.context.extensionUri);
  }

  track(uri) {
    this.openPreviewUris.add(uri.toString());
  }

  refresh() {
    for (const uriText of this.openPreviewUris) {
      this.emitter.fire(vscode.Uri.parse(uriText));
    }
  }
}

async function openPreviewToSide(provider) {
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
  await vscode.commands.executeCommand('markdown.showPreviewToSide', previewUri);
}

async function renderPreview(uri, extensionUri) {
  const params = new URLSearchParams(uri.query);
  const projectRoot = params.get('root');
  const viewId = params.get('view');
  if (projectRoot === null || viewId === null) {
    return 'Stem preview could not resolve the requested view.';
  }

  try {
    const rendered = await runStemPreview(projectRoot, viewId, extensionUri);
    return rendered.stdout;
  } catch (error) {
    return `# Stem Preview Error\n\n\`\`\`text\n${toErrorMessage(error)}\n\`\`\`\n`;
  }
}

async function runStemPreview(projectRoot, viewId, extensionUri) {
  const configuredCli = vscode.workspace.getConfiguration('stem').get('cliPath', '').trim();
  if (configuredCli.length > 0) {
    return execFileAsync(configuredCli, ['preview', 'view', viewId], { cwd: projectRoot });
  }

  const workspaceCli = path.join(projectRoot, 'dist', 'cli', 'index.js');
  if (existsSync(workspaceCli)) {
    return execFileAsync(process.execPath, [workspaceCli, 'preview', 'view', viewId], { cwd: projectRoot });
  }

  const bundledCli = path.resolve(extensionUri.fsPath, '..', '..', 'dist', 'cli', 'index.js');
  if (existsSync(bundledCli)) {
    return execFileAsync(process.execPath, [bundledCli, 'preview', 'view', viewId], { cwd: projectRoot });
  }

  return execFileAsync('stem', ['preview', 'view', viewId], { cwd: projectRoot });
}

function createPreviewUri(projectRoot, viewId, sourceUri) {
  const query = new URLSearchParams({
    root: projectRoot,
    view: viewId,
    source: sourceUri.toString()
  });
  return vscode.Uri.parse(`${PREVIEW_SCHEME}:/${encodeURIComponent(viewId)}.md?${query.toString()}`);
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

function isRelevantDocument(document) {
  return document.uri.scheme === 'file' && document.languageId === 'markdown';
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

module.exports = {
  activate,
  deactivate
};
