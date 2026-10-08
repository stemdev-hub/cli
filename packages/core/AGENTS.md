# packages/core (@stemdev/core)

Published to npm. Portable domain logic. See ADR-0001.

- build: `pnpm --filter @stemdev/core build`
- test: `pnpm --filter @stemdev/core test`
- typecheck: `pnpm --filter @stemdev/core typecheck`
- No Node built-ins or globals (process, Buffer, fetch, console, performance) and no clock reads: time is passed in as `nowMs`.
- No gray-matter. Frontmatter policy: ADR-0002.
- Never import from packages/cli or packages/vscode-stem.
- Everything exported from `src/index.ts` is public API. Do not export internals.
