import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { remark } from 'remark';
import GithubSlugger from 'github-slugger';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = new Set(['packages/cli/spike/test-input.md']);

function nodeText(node) {
  if (node.type === 'html') return node.value.replace(/<[^>]*>/g, '');
  return node.value ?? node.alt ?? (node.children ?? []).map(nodeText).join('');
}

export function markdownInfo(source) {
  const tree = remark().parse(source);
  const anchors = new Set();
  const headings = [];
  const links = [];
  const codes = [];
  const definitions = new Map();
  const references = [];
  const slugger = new GithubSlugger();
  function visit(node) {
    if (node.type === 'heading') {
      const text = nodeText(node);
      const slug = slugger.slug(text);
      headings.push({ text, slug });
      anchors.add(slug);
    }
    if (node.type === 'html') {
      for (const match of node.value.matchAll(/<a\s+[^>]*?(?:id|name)=["']([^"']+)["'][^>]*>/gi)) anchors.add(match[1]);
    }
    if (node.type === 'definition') definitions.set(node.identifier, node.url);
    if (node.type === 'link' || node.type === 'image') links.push({ url: node.url, line: node.position.start.line });
    if (node.type === 'linkReference' || node.type === 'imageReference') references.push(node);
    if (node.type === 'code') codes.push(node);
    for (const child of node.children ?? []) visit(child);
  }
  visit(tree);
  for (const node of references) {
    const url = definitions.get(node.identifier);
    if (url) links.push({ url, line: node.position.start.line });
  }
  return { anchors, headings, links, codes };
}

export function existingPaths(files) {
  const paths = new Set(['.']);
  for (const file of files) {
    paths.add(file);
    let parent = path.posix.dirname(file);
    while (parent !== '.') {
      paths.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  return paths;
}

export function checkLocalLinks(documents, paths = existingPaths([...documents.keys()])) {
  const errors = [];
  const parsed = new Map([...documents].map(([file, source]) => [file, markdownInfo(source)]));
  let checked = 0;
  for (const [file, info] of parsed) {
    if (fixtures.has(file)) continue;
    for (const link of info.links) {
      let url = link.url;
      let repositoryRooted = false;
      const ownUrl = /^https:\/\/github\.com\/stemdev-hub\/cli\/(?:blob|tree)\/main\/(.+)$/.exec(url);
      if (ownUrl) {
        url = ownUrl[1];
        repositoryRooted = true;
      } else if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) continue;
      checked++;
      try {
        const hash = url.indexOf('#');
        const rawPath = (hash < 0 ? url : url.slice(0, hash)).split('?')[0];
        const fragment = hash < 0 ? '' : decodeURIComponent(url.slice(hash + 1));
        const pathname = decodeURIComponent(rawPath);
        const target = !pathname ? file : path.posix.normalize(
          repositoryRooted || pathname.startsWith('/')
            ? pathname.replace(/^\/+/, '')
            : path.posix.join(path.posix.dirname(file), pathname)
        );
        if (!paths.has(target)) errors.push(file + ':' + link.line + ': missing target ' + link.url);
        else if (fragment && parsed.has(target) && !parsed.get(target).anchors.has(fragment)) {
          errors.push(file + ':' + link.line + ': missing anchor ' + link.url);
        }
      } catch {
        errors.push(file + ':' + link.line + ': malformed URL ' + link.url);
      }
    }
  }
  return { errors, checked };
}

export function checkDecisionMetadata(documents) {
  const errors = [];
  const records = new Map();
  for (const [file, content] of documents) {
    const match = /^docs\/decisions\/(\d{4})-[^/]+\.md$/.exec(file);
    if (!match || match[1] === '0000') continue;
    const status = /^Status:\s*(.+)$/m.exec(content)?.[1];
    if (!status || !/^(proposed|accepted|rejected|withdrawn|superseded by)\b/i.test(status)) errors.push(file + ': missing or invalid decision status');
    if (records.has(match[1])) errors.push(file + ': duplicate decision identifier ' + match[1]);
    records.set(match[1], { file, status: status ?? '', targets: [] });
  }
  for (const record of records.values()) {
    const targets = [...record.status.matchAll(/superseded by\s+\[?(?:ADR-)?(\d{4})/gi)].map(m => m[1]);
    if (/superseded/i.test(record.status) && targets.length === 0) errors.push(record.file + ': supersession must identify a replacement ADR');
    record.targets = targets;
    const info = markdownInfo(documents.get(record.file));
    for (const id of targets) {
      const target = records.get(id);
      if (!target || !/^(accepted|superseded by)\b/i.test(target.status)) errors.push(record.file + ': replacement ADR-' + id + ' has no accepted history');
      if (!target || !info.links.some(link => path.posix.normalize(path.posix.join(path.posix.dirname(record.file), link.url.split('#')[0])) === target.file)) errors.push(record.file + ': link the replacement ADR-' + id);
    }
  }
  function visit(id, trail) {
    if (trail.has(id)) return true;
    return (records.get(id)?.targets ?? []).some(next => visit(next, new Set([...trail, id])));
  }
  for (const id of records.keys()) if (visit(id, new Set())) errors.push(records.get(id).file + ': supersession cycle');
  for (const [file, content] of documents) {
    if (!/^docs\/specs\/[^/]+\.md$/.test(file)) continue;
    const intro = content.split(/^## /m)[0];
    const state = /^Status:\s*(proposed|accepted)\b/im.exec(intro)?.[1].toLowerCase();
    const governing = [...intro.matchAll(/\[ADR-(\d{4})\]\(([^)]+)\)/g)];
    if (!state || governing.length === 0) errors.push(file + ': identify status and governing ADR links');
    for (const match of governing) {
      const record = records.get(match[1]);
      if (!record) errors.push(file + ': missing governing ADR-' + match[1]);
      else if (state === 'accepted' && !/^(accepted|superseded by)\b/i.test(record.status)) errors.push(file + ': accepted specification depends on unaccepted ADR-' + match[1]);
    }
  }
  return errors;
}

export const labelOwners = new Map([
  ['docs/specs/block-model.md', ['D1','D2','D3','D4','D4a','D4b','D4c','D6','D7','D8','D9','D10','D22','D23','D29']],
  ['docs/specs/stem-syntax.md', ['D11','D26','D27','D28']],
  ['docs/specs/composition.md', ['D11','D12','D13','D14','D16','D17','D18','D19','D20','D21','D24','D25']],
  ['docs/specs/project-connections.md', ['D5']],
  ['roadmap.md', ['D15','D23']]
]);

export function checkLabelOwners(documents, owners = labelOwners) {
  const errors = [];
  for (const [file, labels] of owners) {
    const found = new Set(markdownInfo(documents.get(file) ?? '').headings.map(h => /^(D\d+[a-c]?)\./.exec(h.text)?.[1]).filter(Boolean));
    for (const label of labels) if (!found.has(label)) errors.push(file + ': missing canonical ' + label);
  }
  return errors;
}

export function sameGenerated(expected, actual) {
  return expected.replace(/\r\n/g, '\n') === actual.replace(/\r\n/g, '\n');
}

async function checkGeneratedReference() {
  // Use the package's declared API Extractor tool, not an undeclared root dependency.
  const cliFolder = path.join(root, 'packages/cli');
  const cliRequire = createRequire(path.join(cliFolder, 'package.json'));
  const { Extractor, ExtractorConfig } = cliRequire('@microsoft/api-extractor');
  const configPath = path.join(cliFolder, 'api-extractor.json');
  const temporaryRoot = path.resolve(tmpdir());
  const temporary = await mkdtemp(path.join(temporaryRoot, 'stem-docs-api-'));
  try {
    const config = ExtractorConfig.loadFile(configPath);
    config.projectFolder = cliFolder;
    config.mainEntryPointFilePath = path.join(cliFolder, 'dist/index.d.ts');
    config.dtsRollup = { ...config.dtsRollup, untrimmedFilePath: path.join(temporary, 'stem-api.d.ts') };
    config.tsdocMetadata = { enabled: true, tsdocMetadataFilePath: path.join(temporary, 'tsdoc-metadata.json') };
    config.apiReport = { ...config.apiReport, enabled: false };
    config.docModel = { ...config.docModel, enabled: false };
    const prepared = ExtractorConfig.prepare({ configObject: config, configObjectFullPath: configPath, packageJsonFullPath: path.join(cliFolder, 'package.json') });
    const result = Extractor.invoke(prepared, { localBuild: true });
    assert.ok(result.succeeded, 'API Extractor failed; build core and CLI before docs:check.');
    const generated = await readFile(path.join(temporary, 'stem-api.d.ts'), 'utf8');
    const tracked = await readFile(path.join(cliFolder, 'docs/stem-api.d.ts'), 'utf8');
    assert.ok(sameGenerated(tracked, generated), 'CLI reference differs from generated declarations. Run pnpm --filter @stemdev/cli docs:types and review.');
    console.log('Generated CLI reference matches.');
  } finally {
    // Delete only the owned, resolved mkdtemp directory, never a computed workspace path.
    assert.equal(path.dirname(path.resolve(temporary)), temporaryRoot);
    assert.ok(path.basename(temporary).startsWith('stem-docs-api-'));
    await rm(temporary, { recursive: true, force: true });
  }
}

async function checkExamples(documents) {
  const coreFolder = path.join(root, 'packages/core');
  const coreManifest = JSON.parse(await readFile(path.join(coreFolder, 'package.json'), 'utf8'));
  // Resolve the declared public ESM entry; require.resolve uses unsupported CJS conditions.
  const core = await import(pathToFileURL(path.resolve(coreFolder, coreManifest.exports['.'].import)).href);
  const usage = markdownInfo(documents.get('packages/core/README.md')).codes.find(code => code.meta === 'stem-check=core-usage');
  assert.ok(usage, 'Missing core README example marker');
  const run = spawnSync(process.execPath, ['--input-type=module', '--eval', usage.value], { cwd: coreFolder, encoding: 'utf8', timeout: 30000 });
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  assert.equal(run.stdout.replace(/\r\n/g, '\n').trim(), '2\n\nWelcome to Stem.');
  const snippets = new Map(markdownInfo(documents.get('docs/reference.md')).codes.filter(code => /^stem-check=/.test(code.meta ?? '')).map(code => [code.meta.slice('stem-check='.length), code.value]));
  for (const name of ['tags', 'parameters']) {
    for (const part of ['block', 'view', 'output']) assert.ok(snippets.has(name + '-' + part), 'Missing example ' + name + '-' + part);
    const block = core.parseBlockFile({ content: snippets.get(name + '-block') + '\n', filePath: '/blocks/example.md', relativePath: 'blocks/example.md' });
    const view = core.parseViewFile({ content: snippets.get(name + '-view') + '\n', filePath: '/views/example.md', relativePath: 'views/example.md' });
    assert.deepEqual(block.errors, []);
    assert.deepEqual(view.errors, []);
    const result = core.renderViewMarkdown(view, [block]);
    assert.ok(result.success, JSON.stringify(result));
    assert.equal(result.markdown.trim(), snippets.get(name + '-output').trim());
  }
  console.log('Core README and current-reference examples passed.');
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--static')) throw new Error('Usage: node scripts/check-docs.mjs [--static]');
  const deleted = new Set(execFileSync('git', ['ls-files', '--deleted', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean));
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(file => file && !deleted.has(file)))];
  const documents = new Map(await Promise.all(files.filter(f => f.endsWith('.md')).map(async file => [file, await readFile(path.join(root, file), 'utf8')])));
  const links = checkLocalLinks(documents, existingPaths(files));
  const errors = [...links.errors, ...checkDecisionMetadata(documents), ...checkLabelOwners(documents)];
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Documentation static checks passed: ' + documents.size + ' Markdown files, ' + links.checked + ' local/repository links, 32 Pure Block labels with canonical owners.');
  if (!args.includes('--static')) {
    await checkExamples(documents);
    await checkGeneratedReference();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
