import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliEntry = path.join(repoRoot, 'src/cli/index.ts');
const tsxCli = path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs');
const cliTestTimeoutMs = 15_000;

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

describe('Stem CLI', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'stem-cli-'));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('initializes a project with --force and reports the project root', async () => {
    await mkdir(path.join(testRoot, '.stem'), { recursive: true });
    await writeFile(path.join(testRoot, '.stem/config.json'), '{"version":"custom"}\n', 'utf8');

    const result = await runStem(['init', '--force']);

    expect(result).toMatchObject({
      exitCode: 0,
      stdout: `Initialized Stem project at ${testRoot}\n`,
      stderr: ''
    });
    await expect(readJson(path.join(testRoot, '.stem/config.json'))).resolves.toMatchObject({
      version: '1',
      blocksDir: 'blocks',
      viewsDir: 'views'
    });
  }, cliTestTimeoutMs);

  it('creates blocks, views, and references with command options', async () => {
    await runStem(['init']);

    const blockResult = await runStem(['create', 'block', 'Auth Flow', '--tag', 'api']);
    const viewResult = await runStem(['create', 'view', 'Auth Service', '--group', 'backend/services']);
    await writeProjectFile(
      'blocks/auth-flow-block.md',
      `---
id: auth-flow-block
---
@stem[section:summary]
@stem[tag:api]
Endpoint summary.
@stem[end]
@stem[end]
`
    );
    const addResult = await runStem([
      'add',
      'auth-flow-block',
      'to',
      'auth-service-view',
      '--section',
      'summary',
      '--tag',
      'api'
    ]);

    expect(blockResult).toEqual({
      exitCode: 0,
      stdout: 'Created block auth-flow-block at blocks/auth-flow-block.md\n',
      stderr: ''
    });
    expect(viewResult).toEqual({
      exitCode: 0,
      stdout: 'Created view auth-service-view at views/backend/services/auth-service-view.md\n',
      stderr: ''
    });
    expect(addResult).toEqual({
      exitCode: 0,
      stdout: 'Added @stem[block:auth-flow-block section=summary tag=api] to auth-service-view\n',
      stderr: ''
    });
    await expect(readProjectFile('blocks/auth-flow-block.md')).resolves.toContain('@stem[tag:api]');
    await expect(readProjectFile('views/backend/services/auth-service-view.md')).resolves.toContain(
      '@stem[block:auth-flow-block section=summary tag=api]'
    );
  }, cliTestTimeoutMs);

  it('deletes a referenced block with --force and reports the deleted path', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await runStem(['delete', 'block', 'auth', '--force']);

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'Deleted auth from blocks/auth.md\n',
      stderr: ''
    });
    await expectPathMissing(path.join(testRoot, 'blocks/auth.md'));
  }, cliTestTimeoutMs);

  it('filters list output for blocks by tag and views by block', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\ntags: [backend]\n---\nAuth block.\n');
    await writeProjectFile('blocks/billing.md', '---\nid: billing\ntags: [frontend]\n---\nBilling block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\ngroup: backend\n---\n@stem[block:auth]\n');
    await writeProjectFile('views/empty.md', '---\nid: empty-view\n---\nNo refs.\n');

    const blocksResult = await runStem(['list', 'blocks', '--tag', 'backend']);
    const viewsResult = await runStem(['list', 'views', '--block', 'auth']);

    expect(blocksResult).toEqual({
      exitCode: 0,
      stdout: 'auth\tblocks/auth.md\ttags:backend\tviews:api-view\n1 block\n',
      stderr: ''
    });
    expect(viewsResult).toEqual({
      exitCode: 0,
      stdout: 'api-view\tviews/api.md\tgroup:backend\tblocks:auth\n1 view\n',
      stderr: ''
    });
  }, cliTestTimeoutMs);

  it('sets a non-zero exit code when check reports validation errors', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:missing]\n');

    const result = await runStem(['check']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('ERROR BROKEN_BLOCK_REF views/api.md: View references missing block "missing".');
    expect(result.stdout).toContain('1 error, 0 warnings');
  }, cliTestTimeoutMs);

  it('prints a sync summary and writes cache files', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await runStem(['sync']);

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'Synced 2 files (2 parsed, 0 cached)\nGraph: 2 nodes, 1 edges\n',
      stderr: ''
    });
    await expect(readJson(path.join(testRoot, '.stem/cache/index.json'))).resolves.toMatchObject({
      version: '1'
    });
    await expect(readJson(path.join(testRoot, '.stem/cache/graph.json'))).resolves.toMatchObject({
      version: '1'
    });
  }, cliTestTimeoutMs);

  it('renders one view to Markdown', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n# API\n\n@stem[block:auth]\n');

    const result = await runStem(['render', 'view', 'api-view']);

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'Rendered api-view to rendered/api.md\n1 view rendered\n',
      stderr: ''
    });
    await expect(readProjectFile('rendered/api.md')).resolves.toBe('---\nid: api-view\n---\n# API\n\nAuth block.\n');
  }, cliTestTimeoutMs);

  it('renders one view to stdout without writing files', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await runStem(['render', 'view', 'api-view', '--stdout']);

    expect(result).toEqual({
      exitCode: 0,
      stdout: '---\nid: api-view\n---\nAuth block.\n',
      stderr: ''
    });
    await expectPathMissing(path.join(testRoot, 'rendered/api.md'));
  }, cliTestTimeoutMs);

  it('renders all views to a custom output directory', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/backend/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');
    await writeProjectFile('views/ops/runbook.md', '---\nid: runbook-view\n---\nRunbook.\n');

    const result = await runStem(['render', 'all', '--out', 'published']);

    expect(result).toEqual({
      exitCode: 0,
      stdout:
        'Rendered api-view to published/backend/api.md\nRendered runbook-view to published/ops/runbook.md\n2 views rendered\n',
      stderr: ''
    });
    await expect(readProjectFile('published/backend/api.md')).resolves.toContain('Auth block.');
    await expect(readProjectFile('published/ops/runbook.md')).resolves.toContain('Runbook.');
  }, cliTestTimeoutMs);

  it('previews one rendered view to stdout without writing files', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await runStem(['preview', 'view', 'api-view']);

    expect(result).toEqual({
      exitCode: 0,
      stdout: '---\nid: api-view\n---\nAuth block.\n',
      stderr: ''
    });
    await expectPathMissing(path.join(testRoot, 'rendered/api.md'));
  }, cliTestTimeoutMs);

  it('reports preview validation errors on stderr with a non-zero exit code', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth tag=api]\n');

    const result = await runStem(['preview', 'view', 'api-view']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Cannot render project with 1 validation error. Run stem check for details.');
    expect(result.stderr).toContain(
      'ERROR INVALID_BLOCK_REF_FILTER views/api.md: Block reference "@stem[block:auth tag=api]" uses a tag filter without a section filter.'
    );
    await expectPathMissing(path.join(testRoot, 'rendered/api.md'));
  }, cliTestTimeoutMs);

  it('reports duplicate create conflicts on stderr with a non-zero exit code', async () => {
    await createStemProject(testRoot);

    const firstResult = await runStem(['create', 'block', 'Auth']);
    const duplicateResult = await runStem(['create', 'block', 'Auth']);

    expect(firstResult.exitCode).toBe(0);
    expect(duplicateResult.exitCode).toBe(1);
    expect(duplicateResult.stdout).toBe('');
    expect(duplicateResult.stderr).toContain(`File already exists: ${path.join(testRoot, 'blocks/auth-block.md')}`);
  }, cliTestTimeoutMs);

  it('refuses to delete referenced blocks without --force', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\n@stem[block:auth]\n');

    const result = await runStem(['delete', 'block', 'auth']);

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: 'Block "auth" is still referenced by: api-view.\n'
    });
    await expect(readProjectFile('blocks/auth.md')).resolves.toContain('Auth block.');
  }, cliTestTimeoutMs);

  it('rejects add commands without the documented "to" connective', async () => {
    await createStemProject(testRoot);
    await writeProjectFile('blocks/auth.md', '---\nid: auth\n---\nAuth block.\n');
    await writeProjectFile('views/api.md', '---\nid: api-view\n---\nView.\n');

    const result = await runStem(['add', 'auth', 'into', 'api-view']);

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: 'Usage: stem add <block-id> to <view-id>\n'
    });
  }, cliTestTimeoutMs);

  it('reports commands run outside a Stem project on stderr with a non-zero exit code', async () => {
    const result = await runStem(['list', 'blocks']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`No Stem project root found from ${testRoot}.`);
  }, cliTestTimeoutMs);

  it('reports render outside a Stem project on stderr with a non-zero exit code', async () => {
    const result = await runStem(['render', 'view', 'api-view']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`No Stem project root found from ${testRoot}.`);
  }, cliTestTimeoutMs);

  it('reports preview outside a Stem project on stderr with a non-zero exit code', async () => {
    const result = await runStem(['preview', 'view', 'api-view']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`No Stem project root found from ${testRoot}.`);
  }, cliTestTimeoutMs);

  async function runStem(args: string[]): Promise<CliResult> {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [tsxCli, cliEntry, ...args], {
        cwd: testRoot,
        env: { ...process.env, NO_COLOR: '1' }
      });
      return { exitCode: 0, stdout, stderr };
    } catch (error) {
      if (isExecError(error)) {
        return {
          exitCode: typeof error.code === 'number' ? error.code : 1,
          stdout: error.stdout ?? '',
          stderr: error.stderr ?? ''
        };
      }

      throw error;
    }
  }

  async function readProjectFile(relativePath: string): Promise<string> {
    return readFile(path.join(testRoot, ...relativePath.split('/')), 'utf8');
  }

  async function writeProjectFile(relativePath: string, content: string): Promise<void> {
    const filePath = path.join(testRoot, ...relativePath.split('/'));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }
});

async function createStemProject(projectRoot: string): Promise<void> {
  await mkdir(path.join(projectRoot, '.stem'), { recursive: true });
  await mkdir(path.join(projectRoot, 'blocks'), { recursive: true });
  await mkdir(path.join(projectRoot, 'views'), { recursive: true });
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function expectPathMissing(filePath: string): Promise<void> {
  try {
    await stat(filePath);
    throw new Error(`Expected path to be missing: ${filePath}`);
  } catch (error) {
    expect(error).toMatchObject({ code: 'ENOENT' });
  }
}

function isExecError(error: unknown): error is Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
} {
  return error instanceof Error && ('stdout' in error || 'stderr' in error || 'code' in error);
}
