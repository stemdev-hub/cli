import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL, URL } from 'node:url';

try {
  if (process.argv.length !== 3) {
    throw new Error('Usage: node scripts/check-packed-core.mjs <core-tarball.tgz>');
  }
  const requireCore = createRequire(new URL('../packages/core/package.json', import.meta.url));
  const loadCoreTool = (specifier) => import(pathToFileURL(requireCore.resolve(specifier)).href);
  const { publint } = await loadCoreTool('publint');
  const { formatMessage } = await loadCoreTool('publint/utils');
  const { createPackageFromTarballData, checkPackage } = await loadCoreTool('@arethetypeswrong/core');
  const data = await readFile(process.argv[2]);
  const pkg = createPackageFromTarballData(data);
  if (pkg.packageName !== '@stemdev/core') {
    throw new Error(`Expected @stemdev/core, received ${pkg.packageName}.`);
  }

  // Supply the tarball itself: publint must never invoke a package manager.
  const tarball = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const lint = await publint({ pack: { tarball }, strict: true });
  let failed = false;
  for (const message of lint.messages) {
    console.error(`publint ${message.type}: ${formatMessage(message, lint.pkg, { color: false }) ?? message.code}`);
    failed = true;
  }
  if (lint.messages.length === 0) console.log('publint strict: passed.');

  const analysis = await checkPackage(pkg);
  if (!analysis.types) {
    console.error('attw: @stemdev/core has no types.');
    failed = true;
  } else {
    // Equivalent to the ESM-only profile: exclude node10 and node16-cjs.
    const resolutions = ['node16-esm', 'bundler'];
    const problems = new Set();
    const entries = Object.entries(analysis.entrypoints);
    if (entries.length === 0) {
      console.error('attw: no package entrypoints found.');
      failed = true;
    }
    for (const [entry, info] of entries) {
      for (const resolution of resolutions) {
        const result = info.resolutions[resolution];
        if (!result?.resolution || !result.implementationResolution) {
          console.error(`attw ${entry} (${resolution}): missing type or implementation resolution.`);
          failed = true;
        }
        for (const index of result?.visibleProblems ?? []) problems.add(index);
      }
    }
    for (const index of problems) {
      console.error(`attw: ${JSON.stringify(analysis.problems[index])}`);
      failed = true;
    }
    if (problems.size === 0 && !failed) console.log('attw ESM-only (node16-esm, bundler): passed.');
  }
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(`Packed core check failed: ${error.message}`);
  process.exitCode = 1;
}
