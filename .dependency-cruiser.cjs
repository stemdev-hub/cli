const core = require('./packages/core/package.json');
const packageNames = ['core', 'cli', 'vscode-stem'];
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const coreDependencies = Object.keys(core.dependencies).map(escapePattern).join('|');
const otherPackages = (name) => packageNames
  .filter((other) => other !== name)
  .map((other) => escapePattern(other === 'vscode-stem' ? other : `@stemdev/${other}`))
  .join('|');
const otherPackagePaths = (name, suffix = '') => [
  `^packages/(?!${name}/)[^/]+/${suffix}`,
  `(?:^|/)node_modules/(?:${otherPackages(name)})/${suffix}`,
  `^(?:${otherPackages(name)})/${suffix}`
];

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'core-no-node-builtins',
      severity: 'error',
      from: { path: '^packages/core/src/' },
      to: { dependencyTypes: ['core'] }
    },
    {
      name: 'core-only-own-files-and-declared-dependencies',
      severity: 'error',
      from: { path: '^packages/core/src/' },
      to: {
        pathNot: [
          '^packages/core/(?!node_modules/)',
          `(?:^|/)node_modules/(?:${coreDependencies})(?:/|$)`
        ]
      }
    },
    {
      name: 'core-no-cli-or-editor',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: '^(?:packages/(?:cli|vscode-stem)/|@stemdev/cli(?:/|$)|vscode-stem(?:/|$)|vscode$)|(?:^|/)node_modules/(?:@stemdev/cli|vscode-stem)(?:/|$)' }
    },
    {
      name: 'core-no-gray-matter',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: '(^|/)gray-matter(/|$)' }
    },
    {
      name: 'vscode-no-cli',
      severity: 'error',
      from: { path: '^packages/vscode-stem/' },
      to: { path: '^packages/cli/|^@stemdev/cli(?:/|$)|(?:^|/)node_modules/@stemdev/cli(?:/|$)' }
    },
    {
      name: 'cli-no-vscode',
      severity: 'error',
      from: { path: '^packages/cli/' },
      to: { path: '^packages/vscode-stem/|^vscode-stem(?:/|$)|(?:^|/)node_modules/vscode-stem(?:/|$)' }
    },
    ...packageNames.map((name) => ({
      name: `${name}-no-other-package-src`,
      severity: 'error',
      // Includes tests; importing this package's own src is allowed.
      from: { path: `^packages/${name}/` },
      to: { path: otherPackagePaths(name, 'src/') }
    })),
    ...packageNames.map((name) => ({
      name: `${name}-use-package-entry`,
      severity: 'error',
      from: { path: `^packages/${name}/` },
      to: {
        path: otherPackagePaths(name),
        dependencyTypes: ['local', 'localmodule']
      }
    })),
    {
      name: 'no-undeclared-npm-dependencies',
      severity: 'error',
      from: { path: '^packages/' },
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown', 'unknown', 'undetermined'] }
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: { path: '^packages/' },
      to: { couldNotResolve: true }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    // CLI tests use tooling declared in the workspace root (e.g. vitest).
    combinedDependencies: true,
    // Keep boundary edges visible, including built workspace package entries.
    doNotFollow: { path: '(^|/)(?:node_modules|dist|coverage)/' },
    exclude: { path: '(^|/)(?:[.]git|[.]temp|[.]stem)/' },
    // Retain node_modules paths so pnpm workspace imports are classified by manifest.
    preserveSymlinks: true,
    // Provided by the VS Code extension host, not by npm.
    builtInModules: { add: ['vscode'] },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['main', 'types', 'typings']
    }
  }
};
