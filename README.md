# Stem

[![CI Status](https://github.com/stemdev-hub/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/stemdev-hub/cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Stem is a Git-native, file-based documentation system for software developers. It keeps reusable knowledge in Markdown blocks and lets teams compose those blocks into multiple view files without duplicating content.

Reusability is Stem's primary purpose; identity, ownership, Tags, and diagnostics support reliable reuse and composition.

Stem is designed for teams working with AI coding agents and LLM workflows: the block store and dynamic connection graph provide structured, queryable context while keeping every source file plain Markdown in Git.

## The Problem

Software documentation gets stale, duplicated, bloated, and locked into a single perspective. Stem separates canonical content from the views people read, so one block can power onboarding, backend, frontend, architecture, and AI-agent context views.

## Ecosystem

Stem is a pnpm monorepo with three packages:

| Package                                         | Purpose                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [@stemdev/core](./packages/core/README.md)      | Portable parsing, graph traversal, validation, and rendering for application and editor integrations. |
| [@stemdev/cli](./packages/cli/README.md)        | Node.js project operations, the `stem` executable, and the MCP context server.                        |
| [vscode-stem](./packages/vscode-stem/README.md) | VS Code previews using bundled core, plus workspace MCP setup.                                        |

Install the CLI to manage a project, the extension for editor previews, or core to build an integration. Package READMEs include installation and usage instructions.

## Start here

- Author and render Markdown: [CLI guide](packages/cli/README.md).
- Preview in an editor or configure MCP: [extension guide](packages/vscode-stem/README.md).
- Integrate the portable engine: [core guide](packages/core/README.md).
- Look up current format semantics and limitations: [shared reference](docs/reference.md).
- Contribute or release: [contribution guide](CONTRIBUTING.md). Find active/deferred work in [roadmap](roadmap.md).

Stem is beta, maintained by its owner. Current usage and proposed product design have separate reading routes; source package versions do not by themselves establish distribution or host acceptance.

## Architecture

`packages/core` contains the pure domain engine. `packages/cli` supplies filesystem, configuration, cache, network, process, terminal, and MCP adapters around it. `packages/vscode-stem` bundles core and supplies editor documents through VS Code APIs; preview does not require an installed CLI.

Core and CLI expose separate ESM public entries. Import portable domain functions and types from `@stemdev/core`; import Node.js project operations from `@stemdev/cli`. The CLI no longer re-exports the former domain/configuration type surface. See [ADR-0001](docs/decisions/0001-extract-core-package.md) for the extraction decision.

Rendered Markdown is generated under `rendered/` by default and should not be committed unless a project intentionally publishes generated output.

See [docs/architecture.md](./docs/architecture.md) for package boundaries and data flow.

The [Pure Block design](docs/architecture.md#proposed-pure-block-design) is proposed, not released behavior. Its specifications and migration work are separate from the current package usage guides.

## Contributing

We welcome contributions! To build the project locally:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Please feel free to open issues or submit pull requests on our [GitHub Repository](https://github.com/stemdev-hub/cli).
You can find details about the release process in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE)
