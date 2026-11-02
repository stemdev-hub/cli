# Stem

[![CI Status](https://github.com/stemdev-hub/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/stemdev-hub/cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@stemdev/cli.svg?color=blue&label=npm)](https://www.npmjs.com/package/@stemdev/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Stem is a Git-native documentation compiler for software developers. It keeps reusable knowledge in Markdown blocks and compiles them into clean, 100% standard Markdown outputs (such as repository READMEs, onboarding guides, or AI agent instructions) ensuring a **Single Source of Truth** without copy-paste drift.

### Clean Output Guarantee
**Zero syntax leakage in published outputs.** You author reusable blocks in your internal source files, but every generated file is pure, standard Markdown with all directives resolved and stripped. External contributors and GitHub readers see clean documentation without needing to know Stem exists.

---

## How It Works

1. **Define reusable content in `blocks/`:**
   ```markdown
   @stem:block(id:install-steps tags:[guide])
   Run `npm install` and configure your environment variables.
   @stem:end()
   ```

2. **Compose your target document:**
   ```markdown
   # My Project

   ## Getting Started
   @stem:include(install-steps)
   ```

3. **Compile exact, standard Markdown:**
   ```markdown
   # My Project

   ## Getting Started
   Run `npm install` and configure your environment variables.
   ```

---

## Quickstart

You can run Stem immediately without installing it globally:

```sh
# Initialize a Stem project (creates blocks/ and .stem/config.json)
npx @stemdev/cli init

# Create a reusable block
npx @stemdev/cli create block welcome --file blocks/guide.md --tag guide

# Verify project references
npx @stemdev/cli check

# Preview or render compiled Markdown to stdout
npx @stemdev/cli preview block welcome
npx @stemdev/cli render block welcome --stdout
```

---

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

Stem is beta, maintained by its owner. Current usage and accepted design awaiting implementation have separate reading routes.

## Architecture

`packages/core` contains the pure domain engine. `packages/cli` supplies filesystem, configuration, cache, network, process, terminal, and MCP adapters around it. `packages/vscode-stem` bundles core and supplies editor documents through VS Code APIs; preview does not require an installed CLI.

Core and CLI expose separate ESM public entries. Import portable domain functions and types from `@stemdev/core`; import Node.js project operations from `@stemdev/cli`. The CLI no longer re-exports the former domain/configuration type surface. See [ADR-0001](docs/decisions/0001-extract-core-package.md) for the extraction decision.

Configured output sets select Blocks or source files and map them to destination files. No output mapping is implicit; generated Markdown may be committed when a project intentionally publishes it.

See [docs/architecture.md](./docs/architecture.md) for package boundaries and data flow.

The [Pure Block design](docs/architecture.md#pure-block-design) governs the coordinated implementation. Connection storage and Git transport remain deferred. Repository implementation does not establish released behavior or real-host acceptance.

## Contributing

To build locally, follow the [development prerequisites](CONTRIBUTING.md#development), then run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Please feel free to open issues or submit pull requests on our [GitHub Repository](https://github.com/stemdev-hub/cli).
You can find details about the release process in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE)
