# @stemdev/core

[![npm version](https://img.shields.io/npm/v/@stemdev/core)](https://www.npmjs.com/package/@stemdev/core)
[![Node version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The pure domain, parsing, graph traversal, validation, and rendering engine for Stem.

Stem stores reusable knowledge as Markdown blocks classified by tags; views compose that content for readers and AI tools. Use core to integrate Stem into a browser, worker, editor, or application. For project files and terminal commands, use [@stemdev/cli](https://github.com/stemdev-hub/cli/tree/main/packages/cli).

## Core invariants

The portability contract is defined in [ADR-0001](https://github.com/stemdev-hub/cli/blob/main/docs/decisions/0001-extract-core-package.md):

- Pure TypeScript with zero Node.js runtime built-ins, including `fs` and `path`, and no Node globals such as `process` or `Buffer`.
- No I/O or clock reads; callers supply documents, snapshots, and time as `nowMs` when analysis requires it.
- Browser and worker compatible, with zero CLI or editor dependencies.
- Consumers use the public `@stemdev/core` entry; reading files, fetching snapshots, and persisting caches belong to the caller.

## Installation

Node.js consumers require Node.js 22 or later. The package provides ESM and TypeScript declarations.

```sh
npm install @stemdev/core
```

## Usage

Parse supplied Markdown, build its graph, and render a view:

```typescript
import {
  parseBlockFile,
  parseViewFile,
  buildGraph,
  renderViewMarkdown as renderView,
} from '@stemdev/core';

const block = parseBlockFile({
  content: '---\nid: welcome\ntags: [guide]\n---\n\nWelcome to Stem.\n',
  filePath: '/project/blocks/welcome.md',
  relativePath: 'blocks/welcome.md',
});
const view = parseViewFile({
  content: '---\nid: onboarding\n---\n\n@stem[block:welcome]\n',
  filePath: '/project/views/onboarding.md',
  relativePath: 'views/onboarding.md',
});

if (block.errors.length > 0 || view.errors.length > 0) {
  throw new Error('Invalid source Markdown');
}
const { graph, issues } = buildGraph([block], [view]);
if (issues.length > 0) throw new Error('Graph construction failed');
const result = renderView(view, [block]);
if (!result.success) throw new Error('View rendering failed');

console.log(graph.nodes.size); // 2
console.log(result.markdown); // Welcome to Stem.
```

`filePath` and `relativePath` identify supplied content; parsing does not read those paths. `renderView` above is a local alias for the public `renderViewMarkdown` export. Core has no export named `renderView`; the CLI exports a separate operation that loads project files.

For full project validation, use `analyzeProject(snapshot, { nowMs })` with caller-supplied documents, schemas, namespace configuration, and external snapshots. Graph construction and rendering alone do not replace project validation. Public types and signatures ship with the package's declarations.

## Contributing

See the [contribution guide](https://github.com/stemdev-hub/cli/blob/main/CONTRIBUTING.md) for workspace setup and checks, and the [architecture guide](https://github.com/stemdev-hub/cli/blob/main/docs/architecture.md) for package responsibilities.

## License

[MIT](https://github.com/stemdev-hub/cli/blob/main/LICENSE)
