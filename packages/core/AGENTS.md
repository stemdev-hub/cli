# packages/core (@stemdev/core)

Published to npm. Portable pure domain logic: Block/Tag model, graph, parser, validator, renderer. See ADR-0001.

## Commands

- build: `pnpm --filter @stemdev/core build`
- test: `pnpm --filter @stemdev/core test`
- typecheck: `pnpm --filter @stemdev/core typecheck`
- packaging verification:
  `pnpm --filter @stemdev/core pack --pack-destination <dir> && node scripts/check-packed-core.mjs <dir>/stemdev-core-*.tgz`
- lint: monorepo root `pnpm lint`

## Boundaries & Constraints

- Zero Node built-ins or globals (process, Buffer, fetch, console, performance).
- Zero clock reads: time is passed in as `nowMs`. Zero I/O, filesystem access, or dynamic imports.
- Enforced mechanically by ESLint AST rules and dependency-cruiser.
- Portable ESM: must run in Node, browser, Web Workers, and Edge runtimes.
- Parsing/decoder policy: [decision applicability](../../docs/architecture.md#current-decision-applicability). No gray-matter.
- Never import from `packages/cli` or `packages/vscode-stem`.
- Everything exported from `src/index.ts` is public API. Additions are cheap; renames and removals require an ADR.
