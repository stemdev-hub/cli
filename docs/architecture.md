# Stem Architecture

Stem has two domain primitives: **Block** and **Tag**. Views and rendering are layered on that model. The extracted monorepo implements the boundaries established by [ADR-0001](decisions/0001-extract-core-package.md); [rules](rules.md) remain the binding package constraints.

## Packages and dependencies

```text
@stemdev/cli                 vscode-stem
Node.js project adapters    VS Code document adapters
CLI commands + MCP          preview + MCP configuration
          |                      |
          +----> @stemdev/core <--+
                 portable domain engine
```

| Package | Responsibility | Public consumer entry |
| --- | --- | --- |
| `packages/core` | Model types, parsing, graph construction/traversal, validation, rendering, and analysis of supplied project documents | `@stemdev/core` (ESM) |
| `packages/cli` | Node.js project operations, filesystem/configuration/cache/network adapters, terminal commands, and the stdio MCP server | `@stemdev/cli` (ESM); `stem` executable |
| `packages/vscode-stem` | VS Code documents, unsaved buffers, preview lifecycle, and workspace MCP configuration | Bundled extension entry, `dist/extension.js` |

The CLI declares core as a runtime dependency. The extension bundles core for preview and configures a separate CLI process for MCP. Neither consumer imports another package's source tree. Core has no dependency on either consumer.

## Portable engine

`packages/core/src/index.ts` is the public export surface. Its modules separate parsing, graph construction/traversal, validation, rendering, portable configuration, and project analysis. See the [core README](../packages/core/README.md) for an executable parsing and rendering example; declarations shipped with the package describe the API.

Consumers provide content and source identities. Core never opens a path, fetches a namespace, persists a cache, or reads the clock. Time-sensitive validation receives `nowMs`. These boundaries allow the same engine to process disk documents, unsaved editor buffers, or browser/worker inputs. Portability is a design contract, not a claim of exhaustive platform certification.

Tag-schema and external-snapshot decoding are pure core operations under [ADR-0004](decisions/0004-core-schema-and-snapshot-decoders.md). Consumers retain I/O, timestamps, fallback policy, and contextual errors. Outstanding policy decisions remain in [status](status.md), including frontmatter policy and namespace/snapshot questions; this guide does not settle them.

## Node.js adapters

`packages/cli/src/runtime/` owns project configuration, filesystem access, persisted cache records, and operation orchestration. `packages/cli/src/cli/commands/` registers arguments and formats operation results. `packages/cli/src/mcp/` exposes project operations over stdio. Public Node.js operations are exported through `packages/cli/src/index.ts`.

The CLI's public types describe its adapter inputs and results. Portable domain/configuration types belong to core; consumers of the pre-extraction CLI type surface must use the current public entries rather than source paths or compatibility re-exports.

For `stem check`, the Node adapter discovers and reads documents, loads schemas and external snapshots, and supplies them to core analysis with the current time. The operation returns validation results; the command formats output and sets the exit status. MCP's reference-checking tool uses that operation as well.

For `stem sync`, the adapter scans documents, checks cache invalidation, parses changed content through core, builds the graph, and persists cache records. Parse-time positions stay out of persisted cache records. The internal `.stem/cache/graph.json` snapshot and external namespace snapshot are distinct formats; see the [remaining namespace issues](status.md#remaining-namespace-issues).

For rendering, the adapter loads project documents and delegates Markdown composition to core. The CLI either writes output under `rendered/` by default or returns Markdown for stdout/preview. Generated output should be committed only when the project intentionally publishes it.

## Editor adapter

`packages/vscode-stem/extension.js` manages the preview and workspace commands; `src/preview-loader.ts` supplies project documents and unsaved buffers to bundled core. VS Code provides the editor and filesystem APIs. The build produces a CommonJS extension bundle while leaving the host's `vscode` module external.

Preview works without CLI installation. The separate MCP setup command discovers a configured or installed CLI, or falls back to npx, and writes editor-specific workspace configuration. See the [extension README](../packages/vscode-stem/README.md) for settings, configuration behavior, and limitations.

## Development and distribution

Use the [contribution guide](../CONTRIBUTING.md) for workspace commands and the package guides for consumer setup. Dependency boundaries are checked by the root dependency-cruiser configuration; implementation types and TSDoc remain the source for implementation documentation.

Core and CLI are independently published npm packages. Core is published before a CLI release that depends on it, as required by ADR-0001. The extension bundles core into a VSIX. Repository fixes and published-consumer verification are tracked separately in the [remediation backlog](../roadmap.md#repository-remediation).
