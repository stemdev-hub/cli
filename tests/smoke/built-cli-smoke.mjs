import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliEntry = path.join(repoRoot, 'dist/cli/index.js');
const smokeRoot = await mkdtemp(path.join(tmpdir(), 'stem-built-cli-'));

try {
  await assertFileExists(cliEntry, 'Built CLI entrypoint is missing. Run pnpm build first.');

  await runStem(['init']);
  await assertFileContains('.gitignore', '.stem/cache/');
  await assertFileContains('.gitignore', 'rendered/');

  await runStem(['create', 'block', 'Auth Flow']);
  await writeProjectFile(
    'blocks/auth-flow-block.md',
    `---
id: auth-flow-block
---
@stem[section:summary]
@stem[tag:api]
endpoint request response summary.
@stem[end]
@stem[end]
`
  );

  await runStem(['create', 'view', 'Auth Service', '--group', 'backend/services']);
  await runStem([
    'add',
    'auth-flow-block',
    'to',
    'auth-service-view',
    '--section',
    'summary',
    '--tag',
    'api'
  ]);

  const checkResult = await runStem(['check']);
  assertIncludes(checkResult.stdout, '0 errors, 0 warnings', 'check output');

  const syncResult = await runStem(['sync']);
  assertIncludes(syncResult.stdout, 'Synced 2 files', 'sync output');
  await assertJsonVersion('.stem/cache/index.json', '1');
  await assertJsonVersion('.stem/cache/graph.json', '1');

  const renderResult = await runStem(['render', 'view', 'auth-service-view']);
  assertIncludes(renderResult.stdout, 'Rendered auth-service-view to rendered/backend/services/auth-service-view.md', 'render output');
  await assertFileContains('rendered/backend/services/auth-service-view.md', 'endpoint request response summary.');

  const stdoutResult = await runStem(['render', 'view', 'auth-service-view', '--stdout']);
  assertIncludes(stdoutResult.stdout, 'endpoint request response summary.', 'render stdout');

  const renderAllResult = await runStem(['render', 'all', '--out', 'published']);
  assertIncludes(renderAllResult.stdout, 'Rendered auth-service-view to published/backend/services/auth-service-view.md', 'render all output');
  await assertFileContains('published/backend/services/auth-service-view.md', 'endpoint request response summary.');

  console.log(`Built CLI smoke test passed in ${smokeRoot}`);
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}

async function runStem(args) {
  try {
    const result = await execFileAsync(process.execPath, [cliEntry, ...args], {
      cwd: smokeRoot,
      env: { ...process.env, NO_COLOR: '1' }
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const exitCode = typeof error.code === 'number' ? error.code : 1;
    throw new Error(
      `stem ${args.join(' ')} failed with exit code ${exitCode}\nstdout:\n${error.stdout ?? ''}\nstderr:\n${error.stderr ?? ''}`
    );
  }
}

async function writeProjectFile(relativePath, content) {
  const filePath = path.join(smokeRoot, ...relativePath.split('/'));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function assertFileExists(filePath, message) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(message);
  }
}

async function assertFileContains(relativePath, expected) {
  const content = await readFile(path.join(smokeRoot, ...relativePath.split('/')), 'utf8');
  assertIncludes(content, expected, relativePath);
}

async function assertJsonVersion(relativePath, expectedVersion) {
  const content = await readFile(path.join(smokeRoot, ...relativePath.split('/')), 'utf8');
  const parsed = JSON.parse(content);
  if (parsed.version !== expectedVersion) {
    throw new Error(`${relativePath} expected version ${expectedVersion}, got ${parsed.version}`);
  }
}

function assertIncludes(actual, expected, label) {
  if (!actual.includes(expected)) {
    throw new Error(`${label} expected to include ${JSON.stringify(expected)}, got:\n${actual}`);
  }
}
