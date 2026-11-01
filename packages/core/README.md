# @stemdev/core

Portable parsing, analysis, selection, composition and edit planning for Stem's Block/Tag model.
The package provides ESM and TypeScript declarations for Node.js 22+, browsers and workers.
It performs no I/O and reads no clock; external metadata validation takes explicit `nowMs`.

## Installation

```sh
npm install @stemdev/core
```

This guide describes the repository's Pure Block API. Published-package availability is tracked in [R10](https://github.com/stemdev-hub/cli/blob/main/roadmap.md#r10-verify-an-authorized-release-delivers-selected-fixes); for an unreleased candidate, use the [local tarball verification procedure](https://github.com/stemdev-hub/cli/blob/main/CONTRIBUTING.md#verification).

## Usage

Supply original source text and a temporary local instance token. Analyze once, then select or
compose against that same analysis. Source identities and definition handles are evaluation-local.

```javascript stem-check=core-usage
import { analyzeProject, compose, DEFAULT_COMPOSITION_LIMITS } from '@stemdev/core';

const local = {};
const analysis = analyzeProject({
  localInstance: local,
  instances: [{ handle: local, sources: [{
    sourceId: 'welcome.md',
    content: '@stem:block(id:welcome tags:[guide])Welcome to Stem.@stem:end()'
  }] }]
});
const result = compose(analysis, {
  kind: 'block', instance: analysis.localInstance, reference: { id: 'welcome' }
}, DEFAULT_COMPOSITION_LIMITS);
if (!result.complete || result.diagnostics.some(d => d.severity === 'error')) {
  throw new Error('Composition is not eligible for export');
}
console.log(result.content);
```

`parse` exposes original-source syntax and diagnostics. `analyzeProject` provides recovered
readonly definitions, containment/inclusion graph checks and configured-output reachability.
`resolveBlockReference` and `findBlocksByTag` preserve ambiguity and incomplete classification.
`compose` always requires explicit limits and returns exact content, completeness and scoped
diagnostics. Preview may display partial content; exporters check eligibility before writing.

The edit planners prepare token-range edits; adapters validate filesystem boundaries, recheck source
inputs and publish edits. Plans and source locations must never be persisted. The external metadata
decoder validates the shared envelope without making metadata into source bodies.
Public declarations own exact signatures.

Use [the CLI](https://github.com/stemdev-hub/cli/tree/main/packages/cli) for disk operations and
[the shared reference](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md) for user semantics.
See [architecture](https://github.com/stemdev-hub/cli/blob/main/docs/architecture.md) and
[contributing](https://github.com/stemdev-hub/cli/blob/main/CONTRIBUTING.md) for boundaries and verification.

## License

[MIT](https://github.com/stemdev-hub/cli/blob/main/LICENSE)
