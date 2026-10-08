// Usage: node scripts/verify-release-tarball.mjs <tarball> [--check-registry]
//        [--check-version-unpublished]
// Exit codes: 0 = pass; 1 = verification failure; 2 = registry/command/network error.
// Only exit 1 AND the exact stdout line below confirms an already published version:
// RELEASE_VERSION_ALREADY_PUBLISHED <name>@<version>
// Other exit-1 failures must never be interpreted as permission to skip publishing.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

// Read regular package/package.json entries without extracting files or running pack scripts.
export function readManifest(tarball) {
  const data = gunzipSync(readFileSync(tarball));
  let manifest;
  for (let offset = 0; offset < data.length; ) {
    if (offset + 512 > data.length) throw new Error('Truncated tar header.');
    const header = data.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, end) => header.subarray(start, end).toString('utf8').split('\0')[0];
    const octal = (start, end) => {
      const value = field(start, end).trim();
      if (!/^[0-7]+$/.test(value)) throw new Error('Invalid tar numeric field.');
      return Number.parseInt(value, 8);
    };
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (checksum !== octal(148, 156)) throw new Error('Invalid tar header checksum.');
    const size = octal(124, 136);
    const start = offset + 512;
    const end = start + size;
    const next = start + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(next) || next > data.length) throw new Error('Truncated tar entry.');
    const prefix = field(345, 500);
    const name = `${prefix ? `${prefix}/` : ''}${field(0, 100)}`.replace(/^\.\//, '');
    if (name === 'package/package.json') {
      if (manifest !== undefined) throw new Error('Duplicate package/package.json.');
      if (![0, 48].includes(header[156])) throw new Error('package/package.json is not a regular file.');
      manifest = JSON.parse(data.subarray(start, end).toString('utf8'));
    }
    offset = next;
  }
  if (!manifest || typeof manifest.name !== 'string' || !manifest.name ||
      typeof manifest.version !== 'string' || !manifest.version) {
    throw new Error('Tarball must contain package/package.json with name and version.');
  }
  return manifest;
}

function npmView(spec) {
  const args = ['view', spec, 'version', '--json', '--fetch-retries=0', '--fetch-timeout=30000'];
  let command = 'npm';
  if (process.platform === 'win32') {
    // Invoke npm's JS entry directly: .cmd files require a shell on Windows.
    const candidates = [process.env.npm_execpath,
      ...[dirname(process.execPath), ...(process.env.PATH ?? '').split(delimiter)]
        .map((directory) => join(directory, 'node_modules/npm/bin/npm-cli.js'))];
    const cli = candidates.find((candidate) => candidate?.endsWith('npm-cli.js') && existsSync(candidate));
    if (!cli) return { error: new Error('Cannot locate npm-cli.js on PATH.') };
    command = process.execPath;
    args.unshift(cli);
  }
  return spawnSync(command, args, { encoding: 'utf8', timeout: 35000, maxBuffer: 1024 * 1024 });
}

function registryResult(result) {
  if (result.error || result.signal) {
    return { error: result.error?.message ?? `npm terminated by ${result.signal}` };
  }
  let output;
  try {
    output = result.stdout?.trim() ? JSON.parse(result.stdout) : [];
  } catch {
    return { error: `Invalid npm response: ${result.stdout}` };
  }
  if (result.status !== 0) {
    let code = output?.error?.code;
    // npm can put its JSON error on stderr instead of stdout.
    try { code ??= JSON.parse(result.stderr).error?.code; } catch { /* Plain stderr is reported below. */ }
    if (code === 'E404' || code === 'ETARGET') return { versions: [] };
    return { error: `npm exited ${result.status}: ${result.stderr || result.stdout}` };
  }
  const versions = typeof output === 'string' ? [output] : output;
  if (!Array.isArray(versions) || versions.some((version) => typeof version !== 'string' || !version.trim())) {
    return { error: `Unexpected npm version response: ${JSON.stringify(output)}` };
  }
  return { versions };
}

export async function verifyTarball(tarball, options = {}, view = npmView, sleep = setTimeout) {
  let pkg;
  const stemDependencies = [];
  try {
    pkg = readManifest(tarball);
    console.log(`Package: ${pkg.name}@${pkg.version}`);
    const failures = [];
    for (const section of sections) {
      const entries = pkg[section] ?? {};
      if (typeof entries !== 'object' || Array.isArray(entries)) throw new Error(`Invalid ${section}.`);
      for (const [name, range] of Object.entries(entries)) {
        if (name.startsWith('@stemdev/')) {
          console.log(`${section}: ${name}@${range}`);
          stemDependencies.push([name, range]);
        }
        if (typeof range !== 'string' || range.startsWith('workspace:')) {
          failures.push(`${section}.${name}: invalid published range ${JSON.stringify(range)}`);
        }
      }
    }
    if (failures.length) throw new Error(failures.join('\n'));
    console.log('PASS: no workspace: specifiers in any dependency section.');
  } catch (error) {
    console.error(`Verification failed: ${error.message}`);
    return 1;
  }

  if (options.checkRegistry) {
    for (const [name, range] of stemDependencies) {
      const spec = `${name}@${range}`;
      let matched = false;
      let last;
      // Initial attempt plus up to six retries, ten seconds apart.
      for (let attempt = 0; attempt <= 6; attempt++) {
        console.log(`Registry check ${attempt + 1}/7: npm view ${name}@"${range}" version`);
        last = registryResult(await view(spec));
        if (last.versions?.length) {
          console.log(`PASS: ${spec} resolves to ${last.versions.join(', ')}.`);
          for (const version of last.versions) console.log(`REGISTRY_VERSION ${name}@${version}`);
          matched = true;
          break;
        }
        console.error(last.error ? `Registry error: ${last.error}` : `No published version satisfies ${spec}.`);
        if (attempt < 6) {
          console.log('Retrying in 10 seconds for registry propagation.');
          await sleep(10000);
        }
      }
      if (!matched) return last.error ? 2 : 1;
    }
  }

  if (options.checkVersionUnpublished) {
    const spec = `${pkg.name}@${pkg.version}`;
    const result = registryResult(await view(spec));
    if (result.error) {
      console.error(`Registry error: ${result.error}`);
      return 2;
    }
    if (result.versions.includes(pkg.version)) {
      console.log(`RELEASE_VERSION_ALREADY_PUBLISHED ${spec}`);
      console.error(`Verification failed: ${spec} already exists on the registry.`);
      return 1;
    }
    if (result.versions.length) {
      console.error(`Registry error: exact-version query returned unexpected versions for ${spec}.`);
      return 2;
    }
    console.log(`PASS: ${spec} is not published.`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [tarball, ...flags] = process.argv.slice(2);
  if (!tarball || tarball.startsWith('--') || flags.some((flag) => !['--check-registry', '--check-version-unpublished'].includes(flag))) {
    console.error('Usage: node scripts/verify-release-tarball.mjs <tarball> [--check-registry] [--check-version-unpublished]');
    process.exitCode = 1;
  } else {
    process.exitCode = await verifyTarball(tarball, {
      checkRegistry: flags.includes('--check-registry'),
      checkVersionUnpublished: flags.includes('--check-version-unpublished')
    });
  }
}
