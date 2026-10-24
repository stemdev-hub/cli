# Stem Architecture

Stem has two domain primitives: **Block** and **Tag**. Views and rendering are layered on that model. The extracted monorepo implements the boundaries established by [ADR-0001](decisions/0001-extract-core-package.md); [rules](rules.md) remain the binding package constraints.

The package and runtime descriptions below cover the current implementation. The [accepted Pure Block design](#pure-block-design) remains a separate implementation target, not current runtime behavior.

## Packages and dependencies

```text
@stemdev/cli                 vscode-stem
Node.js project adapters    VS Code document adapters
CLI commands + MCP          preview + MCP configuration
          |                      |
          +----> @stemdev/core <--+
                 portable domain engine
```

| Package                | Responsibility                                                                                                           | Public consumer entry                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `packages/core`        | Model types, parsing, graph construction/traversal, validation, rendering, and analysis of supplied project documents    | `@stemdev/core` (ESM)                        |
| `packages/cli`         | Node.js project operations, filesystem/configuration/cache/network adapters, terminal commands, and the stdio MCP server | `@stemdev/cli` (ESM); `stem` executable      |
| `packages/vscode-stem` | VS Code documents, unsaved buffers, preview lifecycle, and workspace MCP configuration                                   | Bundled extension entry, `dist/extension.js` |

The CLI declares core as a runtime dependency. The extension bundles core for preview and configures a separate CLI process for MCP. Neither consumer imports another package's source tree. Core has no dependency on either consumer.

## Portable engine

`packages/core/src/index.ts` is the public export surface. Its modules separate parsing, graph construction/traversal, validation, rendering, portable configuration, and project analysis. See the [core README](../packages/core/README.md) for an executable parsing and rendering example; declarations shipped with the package describe the API.

Consumers provide content and source identities. Core never opens a path, fetches a namespace, persists a cache, or reads the clock. Time-sensitive validation receives `nowMs`. These boundaries allow the same engine to process disk documents, unsaved editor buffers, or browser/worker inputs. Portability is a design contract, not a claim of exhaustive platform certification.

The pure external-snapshot decoder introduced by [ADR-0004](decisions/0004-core-schema-and-snapshot-decoders.md) remains supported, with consumers retaining I/O, timestamps, fallback policy, and contextual errors. [ADR-0005](decisions/0005-pure-block-model.md) supersedes only its Tag-schema requirements; that decoder and the Tag-schema validation/loading paths have been removed. The [transition contract](specs/block-model.md#d23-schema-retirement-transition) owns configuration rejection and file preservation. Remaining work is tracked in [roadmap](../roadmap.md#current-behavior-and-policy).

## Node.js adapters

`packages/cli/src/runtime/` owns project configuration, filesystem access, persisted cache records, and operation orchestration. `packages/cli/src/cli/commands/` registers arguments and formats operation results. `packages/cli/src/mcp/` exposes project operations over stdio. Public Node.js operations are exported through `packages/cli/src/index.ts`.

The CLI's public types describe its adapter inputs and results. Portable domain/configuration types belong to core; consumers of the pre-extraction CLI type surface must use the current public entries rather than source paths or compatibility re-exports.

For `stem check`, the Node adapter discovers and reads documents, loads external snapshots, and supplies them to core analysis with the current time. The operation returns validation results; the command formats output and sets the exit status. MCP's reference-checking tool uses that operation as well.

For `stem sync`, the adapter scans documents, checks cache invalidation, parses changed content through core, builds the graph, and persists cache records. Parse-time positions stay out of persisted cache records. The internal `.stem/cache/graph.json` snapshot and external namespace snapshot are distinct formats; see the [remaining namespace issues](../roadmap.md#remaining-namespace-issues).

For rendering, the adapter loads project documents and delegates Markdown composition to core. The CLI either writes output under `rendered/` by default or returns Markdown for stdout/preview. Generated output should be committed only when the project intentionally publishes it.

## Editor adapter

`packages/vscode-stem/extension.js` manages the preview and workspace commands; `src/project.ts` supplies project documents and unsaved buffers to bundled core. VS Code provides the editor and filesystem APIs. The build produces a CommonJS extension bundle while leaving the host's `vscode` module external.

Preview works without CLI installation. The separate MCP setup command discovers a configured or installed CLI, or falls back to npx, and writes editor-specific workspace configuration. See the [extension README](../packages/vscode-stem/README.md) for settings, configuration behavior, and limitations.

## Development and distribution

Use the [contribution guide](../CONTRIBUTING.md) for workspace commands and the package guides for consumer setup. Dependency boundaries are checked by the root dependency-cruiser configuration; implementation types and TSDoc remain the source for implementation documentation.

Core and CLI are independently published npm packages. Core is published before a CLI release that depends on it, as required by ADR-0001. The extension bundles core into a VSIX. Repository fixes and published-consumer verification are tracked separately in the [remediation backlog](../roadmap.md#repository-remediation).

<a id="proposed-pure-block-design"></a>

## Pure Block design

Status: accepted design; implementation pending. [ADR-0005](decisions/0005-pure-block-model.md) and [ADR-0007](decisions/0007-independent-project-connections.md) record the accepted model and independent-connection choices, with their four specifications. [ADR-0006](decisions/0006-documentation-ownership.md) governs documentation structure; the [roadmap](../roadmap.md#documentation-and-decision-review) records the acceptance checkpoint and remaining work.

The accepted model separates authored Block ownership and classification from source syntax and composition. Project connections supply source instances and their reference contexts to that evaluation. The existing package boundaries remain the framework for core contracts and adapter I/O; the documents below own the detailed contracts.

Ordinary Blocks and whole files provide document assembly through the same parser and composition
engine. [Output sets](specs/composition.md#output-sets-and-targets) map those sources to named files;
there is no separate Page primitive. Portable configuration validation and composition belong in
core. Adapters resolve destinations, publish files, persist the
[output manifest](specs/composition.md#output-manifest), and apply selective cleanup. Source connections
provide content; they do not cause connected projects' output sets to execute.

```text
source files / selected Blocks -> core composition -> eligible Markdown
output-set mappings + existing destination state  -> adapter publication / cleanup
```

| Specification                                           | Owns                                                                                                      | Original D-labels                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Block model](specs/block-model.md)                     | Content, containment, identity, classification, selection, Tag equality, and schema-retirement transition | D1–D4, D4a–D4c, D6–D10, D22–D23, D29                 |
| [Stem syntax](specs/stem-syntax.md)                     | Directives, metadata, escaping, boundaries, and syntax recovery                                           | D11 syntax; D26–D28                                  |
| [Composition](specs/composition.md)                     | Substitution, evaluation, budgets, output sets, destinations, publication, tracking and cleanup           | D11 behavior; D12–D14, D16–D21, D24–D25              |
| [Project connections](specs/project-connections.md)     | Identity, aliases, sources, revisions, dependency resolution, refresh, and lifecycle                      | D5                                                   |
| [Migration backlog](../roadmap.md#pure-block-migration) | Dependency-review deferral, schema retirement execution/deferral, and open mechanics                      | D15; D23 planning; deferred portions of D5, D24, D27 |

D-labels are retained for traceability, not separate ADRs. D11 is split between syntax and substitution; D29 owns decoded Tag-name validation, with parsing linked from the syntax specification. Existing ADR dispositions and remaining implementation prerequisites are tracked in the [decision review](../roadmap.md#documentation-and-decision-review).

## Current-decision applicability

ADR status is the canonical decision state; this map is navigation. Acceptance does not establish implementation, host acceptance or distribution. [Roadmap](../roadmap.md) owns those work states, and the [current reference](reference.md) describes observed user behavior.

| Topic                                                                        | Governing record                                                   | Applicability                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Package extraction, portability, public entries and core-first release order | [ADR-0001](decisions/0001-extract-core-package.md)                 | Applicable; API removals/renames require an ADR                                               |
| Frontmatter schema                                                           | [ADR-0002](decisions/0002-frontmatter-yaml-core-schema.md)         | Superseded in full by ADR-0005; legacy runtime parsing remains until replacement              |
| Model versus core package                                                    | [ADR-0003](decisions/0003-clarify-axiom-4.md)                      | Applicable; completed clarification is not supersession                                       |
| Pure schema and external-snapshot decoders                                   | [ADR-0004](decisions/0004-core-schema-and-snapshot-decoders.md)    | Tag-schema requirements superseded by ADR-0005; external-snapshot requirements remain binding |
| Pure Block model and composition                                             | [ADR-0005](decisions/0005-pure-block-model.md) and the specs above | Accepted; implementation pending, with open mechanics retained                                |
| Separation of ADRs, specifications and navigation                            | [ADR-0006](decisions/0006-documentation-ownership.md)              | Remaining provisions apply; its blanket ADR triggers are superseded by ADR-0008               |
| Independent project connections                                              | [ADR-0007](decisions/0007-independent-project-connections.md)      | Accepted; existing namespace snapshots do not implement this contract                         |
| Documentation ownership and lifecycle                                        | [ADR-0008](decisions/0008-documentation-lifecycle.md)              | Applicable; operational policy lives in [governance](governance.md)                           |
| Retirement of the hard/soft-edge axiom                                       | [ADR-0009](decisions/0009-retire-hard-soft-edge-axiom.md)          | Applicable; retires only the former axiom, with no runtime behavior change                    |

## Terms used in this guide

- **Core model:** Block and Tag; **core package:** portable implementation, which may also contain layered rendering and validation.
- **View:** current authored composition input; it is not a third core-model primitive.
- **Section/tag fragment:** legacy authoring structures described by the [current reference](reference.md#body-markers-and-classification), distinct from the accepted nested Block model awaiting implementation.
- **Namespace snapshot:** current structural metadata used for external checking; **project connection:** accepted independent source/revision context awaiting implementation.
- **Acceptance:** an owner design decision; **implementation/host acceptance/distribution:** separately evidenced work outcomes.

## Historical evidence

The [October repository assessment](history/2026-10-repository-audit.md) contains scope, research, corrections, migration traceability and preserved audit/task evidence. The [legacy CLI PRD](history/legacy-cli-prd.md) and [decision journal](history/legacy-cli-decisions.md) retain earlier thinking with dated qualifications. They do not override current guidance or accepted records. Superseded decisions stay at their original paths.
