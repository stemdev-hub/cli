# Contributing to Stem

Stem is a pnpm monorepo with a portable engine, Node.js CLI/MCP adapters, and a VS Code extension. Keep contributions small, typed, and aligned with the [architecture](docs/architecture.md), [repository instructions](AGENTS.md), and [governance](docs/governance.md).

## Workspace structure

| Package | Work here for | Guide |
| --- | --- | --- |
| `packages/core` | Pure parsing, graph traversal, validation, rendering, and project analysis | [Core README](packages/core/README.md) |
| `packages/cli` | Node.js project operations in `src/runtime/`, commands in `src/cli/`, and the server in `src/mcp/` | [CLI README](packages/cli/README.md) |
| `packages/vscode-stem` | Editor documents, live preview, and workspace MCP setup | [Extension contribution guide](packages/vscode-stem/CONTRIBUTING.md) |

## Development

Use Node.js 22 or later and the pnpm version declared in the root `package.json` (`packageManager`). From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm depcruise
pnpm --filter @stemdev/cli smoke:built-cli
node scripts/check-doc-budgets.mjs
git diff --check
```

The recursive build follows workspace dependencies. Use `pnpm --filter @stemdev/core build`, `pnpm --filter @stemdev/cli build`, or `pnpm --filter vscode-stem build` for targeted builds; build core before building the CLI in isolation. All three packages have `test` and `typecheck` scripts. Run the checks relevant to your change and the required checks in the applicable package instructions.

To package an extension candidate after building:

```sh
pnpm --filter vscode-stem exec vsce package --no-dependencies --out <absolute-temporary-vsix-path>
```

Follow the extension guide for host acceptance checks. Mocked tests and packaging do not prove editor integration. In sandboxed environments, filesystem access denial during a build may require rerunning with approved broader access.

## Contribution rules

Follow the [binding rules](docs/rules.md) and [ADR-0001](docs/decisions/0001-extract-core-package.md) for package boundaries. Portable logic belongs in core; Node.js I/O and orchestration belong in CLI runtime operations; editor integration belongs in the extension. Use public package entries and `import type` for type-only imports.

Keep validation read-only and persisted cache output under `.stem/cache/`. Public API changes and architecture decisions follow the existing ADR process in [docs/decisions/](docs/decisions/) and governance. Protected instructions are owner-edited; report drift rather than changing them. Follow the repository's documentation skill when changing guidance, and update [status](docs/status.md) with links to the owning task instead of duplicating its record.

## Commit messages

Follow Conventional Commits, using `feat:`, `fix:`, `chore:`, `docs:`, `test:`, or `refactor:` as appropriate. Keep messages short and specific; reference the affected module when useful, for example `fix(parser): preserve escaped references`.

## Release process

The existing [release workflow](.github/workflows/release-please.yml) uses Release Please and npm OIDC trusted publishing. Review the concrete release candidate and obtain separate owner authorization before merging or publishing; see [R10](roadmap.md#r10-verify-an-authorized-release-delivers-selected-fixes).

- Release Please maintains package-specific versions and changelogs for core, CLI, and the extension.
- Authorized stable releases publish core before a dependent CLI, verify packed artifacts and core dependency ranges, and attach the extension VSIX to its GitHub release. A GitHub VSIX release does not establish Marketplace publication.
- Other pushes to `main` can publish core and CLI canaries under npm's `next` tag and upload a canary VSIX artifact. Treat merges to this branch as publishing actions requiring authorization.
- Use local tarballs and temporary VSIX candidates for isolated checks. Published-consumer verification remains separate from source completion; follow the task-specific acceptance checks in the [roadmap](roadmap.md#shared-task-requirements-and-validation).

Preserve the configured workflow identity and review trusted-publisher settings before any repository/workflow rename. Do not publish packages merely to test a documentation change.
