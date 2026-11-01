# packages/vscode-stem (vscode-stem)

VS Code extension for Stem. Bundles `@stemdev/core` for in-process view preview; invokes CLI for MCP setup. See ADR-0001.

## Commands

- build: `pnpm --filter vscode-stem build` (bundles core with esbuild)
- test: `pnpm --filter vscode-stem test` (runs vitest suite in `tests/`; builds core & CLI)
- typecheck: `pnpm --filter vscode-stem typecheck`
- package VSIX: `pnpm --filter vscode-stem exec vsce package --no-dependencies`
- lint: root `pnpm lint` (checks extension TypeScript; `extension.js` source entry ignored)

Run build, test, and typecheck before calling a change done. Package VSIX to verify bundle.

## Boundaries & Constraints

- Bundled core (`@stemdev/core`) handles in-process preview and analysis. Never invoke CLI for preview.
- Never import `packages/cli` or `@stemdev/cli` directly. CLI is only spawned as an external process for `stem.enableMcp`.
- Never reimplement parsing, graph, or validation logic here; consume `@stemdev/core`.
- Host configuration: serialize VS Code MCP under `servers.stem` (Cursor under `mcpServers.stem`).
