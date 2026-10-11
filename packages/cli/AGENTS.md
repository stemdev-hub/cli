# packages/cli (@stemdev/cli)

Node.js CLI binary, runtime adapters (fs, cache, network), and stdio MCP server.
Consumes `@stemdev/core` as a runtime dependency. See ADR-0001.

## Commands

- build: `pnpm --filter @stemdev/cli build`
- test: `pnpm --filter @stemdev/cli test`
- typecheck: `pnpm --filter @stemdev/cli typecheck`
- built-CLI smoke: `pnpm --filter @stemdev/cli smoke:built-cli` (requires build first)
- type declarations / API reference: `pnpm --filter @stemdev/cli docs:types`
- lint: monorepo root `pnpm lint`

Run build, test, typecheck, and smoke before calling a change done.
Core must be built first (`pnpm --filter @stemdev/core build`) if core changes.

## Boundaries & Constraints

- Never import from `packages/vscode-stem` or `vscode-stem`.
- Never import `packages/core/src/`; import only from public entry `@stemdev/core`.
- MCP server lives in `src/mcp/`; do not extract it to a separate package.
- Domain logic belongs in `@stemdev/core`; do not reintroduce domain models here.
- Public exports in `src/index.ts` are a contract; update API docs with `docs:types`.
