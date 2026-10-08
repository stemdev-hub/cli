import { access, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { analyzeProject } from '@stemdev/core';
import { fileUri, mockApi, previewUri, stem, writeProjectFile } from './helpers.js';

const cliPath = fileURLToPath(new URL('../../cli/dist/cli/index.js', import.meta.url));
const exec = promisify(execFile);
let root: string;

beforeAll(async () => {
  try { await access(cliPath); }
  catch { throw new Error(`CLI dist is missing at ${cliPath}. Build @stemdev/core and @stemdev/cli before running parity tests; the extension test script does this automatically.`); }
});
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'stem-preview-parity-'));
  await mkdir(path.join(root, '.stem'));
  await writeProjectFile(root, 'blocks/auth.md', '---\nid: auth\n---\nAuth.');
  await writeProjectFile(root, 'views/api.md', '---\nid: api\n---\n@stem[block:auth]');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function cli(...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try { return { ...await exec(process.execPath, [cliPath, ...args], { cwd: root }), code: 0 }; }
  catch (error) {
    const failure = error as Error & { stdout: string; stderr: string; code: number };
    if (typeof failure.code !== 'number') throw error;
    return { stdout: failure.stdout, stderr: failure.stderr, code: failure.code };
  }
}

async function expectPreviewParity(view = 'api'): Promise<void> {
  const expected = await cli('preview', 'view', view);
  const { api } = mockApi();
  const actual = await stem.renderPreview(previewUri(root, view), api);
  if (expected.code === 0) {
    expect(actual).toBe(stem.toPreviewDisplayMarkdown(expected.stdout));
  } else {
    expect(actual).toContain('# Stem Preview Error');
    expect(actual).toContain(`## stderr\n\n\`\`\`text\n${expected.stderr.trim()}\n\`\`\``);
    expect(actual).toContain(`## Summary\n\n${expected.stderr.trim().split(/\r?\n/)[0]}`);
    expect(actual).toContain('## Next Action');
  }
}

async function expectDiscoveryParity(): Promise<void> {
  const { api } = mockApi();
  const { snapshot } = await stem.loadProjectSnapshot(api, fileUri(root));
  for (const kind of ['blocks', 'views'] as const) {
    const output = await cli('list', kind, '--json');
    expect(output.code).toBe(0);
    const entries = JSON.parse(output.stdout) as { relativePath: string }[];
    expect(snapshot[kind].map((document) => document.relativePath)).toEqual(entries.map((entry) => entry.relativePath));
    expect(snapshot[kind].every((document) => !document.relativePath.includes('\\'))).toBe(true);
  }
  await expectPreviewParity();
}

describe('built CLI preview parity', () => {
  it('matches local Markdown, sections, duplicate tags and final newline', async () => {
    await writeProjectFile(root, 'blocks/auth.md', '---\nid: auth\n---\n@stem[section:summary]\n@stem[tag:api]\nFirst.\n@stem[end]\n@stem[tag:api]\nSecond.\n@stem[end]\n@stem[end]');
    await writeProjectFile(root, 'views/api.md', '---\nid: api\ngroup: backend\n---\n# API\n\n@stem[block:auth section=summary tag=api]');
    await expectPreviewParity();
  });

  it.each(['local', 'cached', 'missing'] as const)('matches %s namespace snapshots', async (mode) => {
    await writeProjectFile(root, '.stem/config.json', JSON.stringify({ namespaces: { other: { localPath: 'sibling', graphUrl: 'unused' } } }));
    const graph = { version: '1', namespace: 'other', publishedAt: '', contentSha: '', blocks: [{ id: 'external', tags: [], sections: [] }], renames: [] };
    if (mode === 'local') await writeProjectFile(root, 'sibling/.stem/cache/stem-graph.json', JSON.stringify(graph));
    if (mode === 'cached') await writeProjectFile(root, '.stem/cache/namespaces/other.json', JSON.stringify({ fetchedAt: new Date().toISOString(), graph }));
    await writeProjectFile(root, 'views/api.md', '---\nid: api\n---\n@stem[block:auth]\n\n@stem[block:other:external]');
    await expectPreviewParity();
    const result = await cli('preview', 'view', 'api');
    expect(result.code).toBe(0);
    if (mode !== 'local') expect(result.stderr).toContain('Falling back to graphUrl cache.');
  });

  it('matches project-validation summaries and exact diagnostic lines', async () => {
    await writeProjectFile(root, 'views/api.md', '---\nid: api\n---\n@stem[block:missing]');
    const result = await cli('preview', 'view', 'api');
    expect(result.stderr).toContain('Cannot render project with 1 validation error. Run stem check for details.');
    expect(result.stderr).toMatch(/ERROR BROKEN_BLOCK_REF views\/api.md:\d+:\d+:/);
    await expectPreviewParity();
  });

  it('matches missing-view summaries', async () => { await expectPreviewParity('missing'); });

  it('matches renderer-failure summaries and exact diagnostic lines', async () => {
    await writeProjectFile(root, 'blocks/auth.md', '---\nid: auth\n---\nHello {{name}}.');
    await writeProjectFile(root, 'views/api.md', '---\nid: api\n---\n@stem[block:auth, unused="ignored"]');
    const result = await cli('preview', 'view', 'api');
    expect(result.stderr).toContain('Cannot render view "api" with 1 validation error.');
    expect(result.stderr).toContain('ERROR MISSING_BLOCK_VARIABLE');
    await expectPreviewParity();
  });

  it.each(['', '# comment', 'null', 'name: api\nrequired: 1'])('matches schema errors for %j', async (content) => {
    await writeProjectFile(root, 'blocks/schemas/api.yaml', content);
    await expectPreviewParity();
  });

  it('preserves UTF-8 BOMs when decoding files, including CLI config errors', async () => {
    await writeProjectFile(root, '.stem/config.json', '\uFEFF{}');
    const result = await cli('preview', 'view', 'api');
    expect(result.code).toBe(1);
    await expectPreviewParity();
  });
});

describe('recursive discovery against built CLI', () => {
  it.each(['.hidden/child.md', '.secret.md', '.git/child.md', 'node_modules/child.md', 'dist/child.md', '.stem/cache/child.md', 'upper.MD', 'other.txt'])('excludes %s from blocks and views and prunes ignored directories', async (file) => {
    await writeProjectFile(root, `blocks/${file}`, '---\nid: excluded-block\n---\nIgnored.');
    await writeProjectFile(root, `views/${file}`, '---\nid: excluded-view\n---\n@stem[block:missing]');
    const { api, raw } = mockApi();
    const { snapshot } = await stem.loadProjectSnapshot(api, fileUri(root));
    expect(snapshot.blocks.map((doc) => doc.relativePath)).toEqual(['blocks/auth.md']);
    expect(snapshot.views.map((doc) => doc.relativePath)).toEqual(['views/api.md']);
    if (file.includes('/')) {
      const pruned = path.join(root, 'blocks', file.split('/')[0]!);
      expect(raw.workspace.fs.readDirectory.mock.calls.map(([target]) => target.fsPath)).not.toContain(pruned);
    }
    await expectDiscoveryParity();
  });

  it('includes lowercase Markdown recursively, ignores .gitignore, and sorts POSIX paths with localeCompare', async () => {
    await writeProjectFile(root, '.gitignore', 'blocks/nested/\nviews/nested/\n');
    const files = ['z.md', 'A.md', 'nested/b.md', 'nested/a.md'];
    for (const [index, file] of files.entries()) {
      await writeProjectFile(root, `blocks/${file}`, `---\nid: block-${index}\n---\nContent.`);
      await writeProjectFile(root, `views/${file}`, `---\nid: view-${index}\n---\nContent.`);
    }
    const { snapshot } = await stem.loadProjectSnapshot(mockApi().api, fileUri(root));
    expect(snapshot.blocks.map((doc) => doc.relativePath)).toEqual(['blocks/auth.md', ...files.map((file) => `blocks/${file}`)].sort((a, b) => a.localeCompare(b)));
    await expectDiscoveryParity();
  });

  it('excludes the configured schema subtree from blocks with Windows-safe relative paths', async () => {
    await writeProjectFile(root, '.stem/config.json', JSON.stringify({ blocksDir: 'custom\\blocks', viewsDir: 'custom\\views', schemasDir: 'custom\\blocks\\definitions' }));
    await writeProjectFile(root, 'custom/blocks/a.md', '---\nid: auth\n---\nCustom.');
    await writeProjectFile(root, 'custom/views/api.md', '---\nid: api\n---\n@stem[block:auth]');
    await writeProjectFile(root, 'custom/blocks/definitions/excluded.md', '---\nid: excluded\n---\nIgnored.');
    const { snapshot } = await stem.loadProjectSnapshot(mockApi().api, fileUri(root));
    expect(snapshot.blocks.map((doc) => doc.relativePath)).toEqual(['custom/blocks/a.md']);
    expect(snapshot.views.map((doc) => doc.relativePath)).toEqual(['custom/views/api.md']);
    await expectDiscoveryParity();
  });

  it.each(['.hidden/bad.yaml', '.secret.yaml', '.git/bad.yml', 'node_modules/bad.yaml', 'dist/bad.yml', '.stem/cache/bad.yaml', 'bad.YAML', 'bad.YML', 'bad.txt'])('excludes schema %s', async (file) => {
    await writeProjectFile(root, `blocks/schemas/${file}`, 'name: [');
    const { snapshot } = await stem.loadProjectSnapshot(mockApi().api, fileUri(root));
    expect(snapshot.schemas.size).toBe(0);
    expect((await cli('preview', 'view', 'api')).code).toBe(0);
    await expectPreviewParity();
  });

  it.each(['yaml', 'yml'])('loads lowercase nested schema .%s despite .gitignore', async (extension) => {
    await writeProjectFile(root, '.gitignore', 'blocks/schemas/');
    await writeProjectFile(root, `blocks/schemas/nested/api.${extension}`, 'name: api\nrequired: [endpoint]');
    await writeProjectFile(root, 'blocks/auth.md', '---\nid: auth\n---\n@stem[section:summary]\n@stem[tag:api]\nRequired content absent.\n@stem[end]\n@stem[end]');
    const { snapshot } = await stem.loadProjectSnapshot(mockApi().api, fileUri(root));
    expect([...snapshot.schemas.values()]).toEqual([{ name: 'api', required: ['endpoint'] }]);
    const result = await cli('preview', 'view', 'api');
    expect(result.stderr).toContain('SCHEMA_VIOLATION');
    await expectPreviewParity();
  });

  it.for(['directory', 'file', 'broken'] as const)('matches %s symlinks', async (kind, context) => {
    await writeProjectFile(root, 'target/linked.md', '---\nid: linked\n---\nLinked.');
    const destination = path.join(root, 'blocks', kind === 'file' ? 'linked.md' : 'linked');
    try {
      await symlink(path.join(root, kind === 'broken' ? 'absent' : kind === 'file' ? 'target/linked.md' : 'target'), destination,
        kind === 'file' ? 'file' : process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && ['EPERM', 'EACCES'].includes(String(error.code))) {
        console.warn(`SYMLINK UNVERIFIED: ${kind} creation denied (${String(error.code)})`);
        context.skip();
      }
      throw error;
    }
    await expectDiscoveryParity();
  });
});

it('measures loading plus analysis for 500 blocks without a performance threshold', async () => {
  await Promise.all(Array.from({ length: 499 }, (_, index) => writeProjectFile(root, `blocks/generated-${index}.md`, `---\nid: generated-${index}\n---\nGenerated block ${index}.`)));
  const start = performance.now();
  const { snapshot } = await stem.loadProjectSnapshot(mockApi().api, fileUri(root));
  const loaded = performance.now();
  const result = analyzeProject(snapshot, { nowMs: Date.now() });
  const analyzed = performance.now();
  expect(result.blocks).toHaveLength(500);
  console.info(`500-block measurement: loading=${(loaded - start).toFixed(1)}ms analysis=${(analyzed - loaded).toFixed(1)}ms total=${(analyzed - start).toFixed(1)}ms`);
});
