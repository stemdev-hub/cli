import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const cli = path.resolve(import.meta.dirname, '../../dist/cli/index.js');
const root = await mkdtemp(path.join(tmpdir(), 'stem-built-cli-'));
const run = async (...args) => exec(process.execPath, [cli, ...args], { cwd: root });
const read = (file) => readFile(path.join(root, file), 'utf8');
try {
  await run('init');
  const original = await read('.stem/config.json');
  const config = JSON.parse(original);
  assert.match(
    config.projectId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  assert.equal(Object.hasOwn(config, 'version'), false);
  await run('init', '--force');
  assert.equal(await read('.stem/config.json'), original);
  assert.equal(await read('.gitignore'), '.stem/cache/\n');
  await mkdir(path.join(root, 'views'));
  await writeFile(path.join(root, 'views/old.md'), 'preserve authored View');
  await run('create', 'block', 'welcome', '--file', 'blocks/source.md', '--tag', 'guide');
  await writeFile(
    path.join(root, 'blocks/source.md'),
    '@stem:block(id:welcome tags:[guide]) exact\r\n🌱 @stem:end()'
  );
  await run('create', 'block', 'page', '--file', 'blocks/page.md');
  await run('add', 'welcome', 'to', 'block', 'page');
  const before = await readdir(path.join(root, '.stem'));
  assert.equal((await run('preview', 'block', 'welcome')).stdout, ' exact\r\n🌱 ');
  assert.equal((await run('render', 'block', 'welcome', '--stdout')).stdout, ' exact\r\n🌱 ');
  assert.deepEqual(await readdir(path.join(root, '.stem')), before);
  const listed = JSON.parse((await run('list', 'blocks', '--json')).stdout);
  assert.equal(listed.data.total, 2);
  assert.equal(
    JSON.parse((await run('list', 'references', 'welcome', '--json')).stdout).data.total,
    1
  );
  assert.equal(JSON.parse((await run('check', '--json')).stdout).data.errors, 0);
  await run('sync');
  assert.equal(JSON.parse(await read('.stem/cache/index.json')).version, '3');
  assert.equal(JSON.parse(await read('.stem/cache/graph.json')).version, '2');
  config.outputSets = {
    docs: {
      outputDir: 'out',
      targets: [
        { source: { kind: 'block', ref: 'welcome' }, path: 'README.md' },
        { source: { kind: 'block', ref: 'welcome' }, path: 'SECOND.md' }
      ]
    }
  };
  await writeFile(path.join(root, '.stem/config.json'), JSON.stringify(config));
  await run('render', 'set', 'docs', '--target', 'README.md');
  await assert.rejects(read('out/SECOND.md'), { code: 'ENOENT' });
  await run('render', 'set', 'docs', '--target', 'README.md', '--target', 'SECOND.md');
  assert.equal(await read('out/README.md'), ' exact\r\n🌱 ');
  await run('rename', 'welcome', 'intro');
  assert.equal(
    JSON.parse(await read('.stem/config.json')).outputSets.docs.targets[0].source.ref,
    'intro'
  );
  await run('render', 'all');
  await writeFile(path.join(root, 'blocks/broken.md'), 'pre@stem:include(missing)post');
  let partial;
  try {
    await run('preview', 'file', 'blocks/broken.md');
    assert.fail('Expected incomplete preview');
  } catch (error) {
    partial = error;
  }
  assert.equal(partial.stdout, 'prepost');
  let blocked;
  try {
    await run('render', 'file', 'blocks/broken.md', '--stdout');
    assert.fail('Expected blocked export');
  } catch (error) {
    blocked = error;
  }
  assert.equal(blocked.stdout, '');
  config.outputSets = {};
  await writeFile(path.join(root, '.stem/config.json'), JSON.stringify(config));
  await run('cleanup', '--output-dir', 'out', '--set', 'docs');
  assert.equal(await read('out/README.md'), ' exact\r\n🌱 ');
  await run('cleanup', '--output-dir', 'out', '--set', 'docs', '--apply');
  await assert.rejects(read('out/README.md'), { code: 'ENOENT' });
  assert.equal(await read('views/old.md'), 'preserve authored View');
  console.log('Built CLI Pure Block workflow smoke passed.');
} finally {
  assert.equal(path.dirname(root), path.resolve(tmpdir()));
  assert.ok(path.basename(root).startsWith('stem-built-cli-'));
  await rm(root, { recursive: true, force: true });
}
