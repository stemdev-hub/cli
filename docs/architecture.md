# Stem Architecture

Stem has two domain primitives: **Block** and **Tag**. The portable engine and its adapters implement
the accepted Pure Block contracts. [Rules](rules.md) bind package boundaries;
[roadmap](../roadmap.md) owns work state, host acceptance and distribution.

## Packages and dependencies

```text
@stemdev/cli                 vscode-stem
Node project adapters       VS Code source/buffer adapters
CLI commands + MCP          preview + MCP configuration
          |                      |
          +----> @stemdev/core <--+
                 portable engine
```

Core and CLI expose ESM public entries. CLI declares core as a runtime dependency; the extension
bundles core for preview and configures a separate CLI process for MCP. Consumers never import
another package's source tree. The extension bundle leaves the host's `vscode` module external.

## Portable engine

`packages/core/src/index.ts` owns public exports. `parser/scanner.ts` retains original source
and UTF-16 token ranges; `project/analysis.ts` builds recovered definitions and scoped diagnostics.
Selection resolves unique IDs or known direct Tag matches without losing ambiguity or incompleteness.
`graph/analysis.ts` checks containment/inclusion cycles and all-configured-output reachability.
Mutable lookup indexes stay private. Analysis handles and source locations are never persisted.

`renderer/compose.ts` traverses supplied analysis iteratively, using the shared active-path helper
and explicit per-output limits. It does not rescan generated text. Results separate exact content,
completeness and applicable diagnostics. `project/editing.ts` prepares source-range edits;
adapters own physical boundaries, current-input checks and writes.

`config/portable.ts` and `config/outputs.ts` normalize strict configuration and readonly mappings.
Core owns lexical validation; adapters own physical containment and destination checks.
Core performs no I/O or clock reads. Time-sensitive external assessment takes `nowMs`.

The public pure external decoder and shape predicate retain ADR-0004's envelope/timestamp obligations.
Block-only metadata contains identity and classification, never authored bodies or source locations.
It cannot resolve an unavailable inclusion. See the [core guide](../packages/core/README.md),
[reference](reference.md#namespace-snapshots) and [projection contract](specs/project-connections.md#external-metadata-projection).

## Node.js adapters

`packages/cli/src/runtime/` owns filesystem, configuration, cache, network and operation orchestration.
Commands and MCP delegate to those operations. `operations/project.ts` loads one fresh source
inventory under `blocksDir`; it never reconstructs an analysis from persisted records.
Reads and preview are write-free. Initialization alone generates new identity and force preserves
valid configuration. Authoring prepares all edits and rechecks relevant inputs before each write;
partial failures retain confirmed changed files, including late configuration/history failures.

Sync freshly parses every source, persisting file metadata and a position-free graph projection.
Internal `graph.json` and external `stem-graph.json` have distinct contracts. Ordinals in an internal
snapshot address records only within that snapshot, not durable or evaluation-local identities.

The shared CLI file writer exclusively creates a unique sibling temporary file, fully writes/closes
it, then publishes. Create mode uses a hard link that fails on an existing destination. Replace mode
renames the prepared file into place. There is no copy or delete-and-replace fallback. Concurrent
replacement may succeed independently; this is not compare-and-swap, a batch transaction or a
crash-durability guarantee. Only invocation-owned temporary files receive best-effort cleanup.

`operations/render.ts` maps selected output sets to scoped composition, then calls the helpers in
`runtime/output/` for whole-plan collision checks, root coordination, manifest tracking and selective
cleanup. All current destinations protect cleanup, including unselected sets. The coordinator holds
root locks through the run-wide pruning decision and retains confirmed outcomes on late failure.
Explicit cleanup assessment is write-free; application rechecks ownership, paths and byte hashes.
The [composition contract](specs/composition.md#d25-export-eligibility-and-publication) owns policies.

## Editor adapter

`extension.js` manages commands and preview invalidation; `src/project.ts` supplies disk and captured
unsaved source/configuration buffers to bundled core. A source URI selects preview without frontmatter
identity. The virtual document contains exact composition content; a separate output channel presents
diagnostics. Changed inputs invalidate both, including when auto-refresh is off. Obsolete evaluations
are rejected and cannot substitute a cached last result. Preview never spawns a CLI process.

MCP setup is a separate retained workflow. It discovers a configured/installed CLI or falls back to
npx and writes editor-specific workspace configuration. See the [extension guide](../packages/vscode-stem/README.md).

## Development and distribution

[Contributing](../CONTRIBUTING.md) owns setup, sequential verification and release procedures.
Core is published before a dependent CLI release. The extension bundles core into a VSIX.
Repository checks do not establish real-host acceptance or delivery of published artifacts.

<a id="proposed-pure-block-design"></a>

## Pure Block design

[ADR-0005](decisions/0005-pure-block-model.md) governs the model and composition;
[ADR-0011](decisions/0011-public-pure-block-integration.md) covers the concrete public replacement.
[ADR-0007](decisions/0007-independent-project-connections.md) governs deferred source connections.
Core accepts supplied finite source-instance graphs; adapters do not yet implement connection storage,
Git transport or lifecycle resolution. Existing namespace metadata is not a substitute.

| Specification                                       | Canonical ownership                                                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [Block model](specs/block-model.md)                 | Content, containment, identity, direct classification, selection, authoring/query contracts; D1–D4, D4a–D4c, D6–D10, D22–D23, D29 |
| [Stem syntax](specs/stem-syntax.md)                 | Directives, metadata, escaping, boundaries and recovery; D11 syntax, D26–D28                                                      |
| [Composition](specs/composition.md)                 | Expansion, budgets, output mapping/publication/cleanup and sync; D11 behavior, D12–D14, D16–D21, D24–D25                          |
| [Project connections](specs/project-connections.md) | Identity, supplied contexts, external metadata and connection lifecycle; D5                                                       |
| [Roadmap](../roadmap.md#pure-block-migration)       | Active/deferred work, including D15 and deferred D5/D23/D27 mechanics                                                             |

## Current-decision applicability

ADR status owns decision state; this map supplies navigation.

| Topic                                                           | Governing record                                                | Applicability                                                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Package boundaries, portability, public entry and release order | [ADR-0001](decisions/0001-extract-core-package.md)              | Binding; public replacement covered by ADR-0011                                                                               |
| Frontmatter schema                                              | [ADR-0002](decisions/0002-frontmatter-yaml-core-schema.md)      | Superseded by ADR-0005                                                                                                        |
| Model versus core package                                       | [ADR-0003](decisions/0003-clarify-axiom-4.md)                   | Applicable clarification                                                                                                      |
| Pure decoders                                                   | [ADR-0004](decisions/0004-core-schema-and-snapshot-decoders.md) | Tag-schema/legacy shape superseded by ADR-0005; pure decoder, envelope, permissive timestamps and adapter boundaries retained |
| Pure Block model                                                | [ADR-0005](decisions/0005-pure-block-model.md)                  | Governs replacement contracts                                                                                                 |
| Documentation structure                                         | [ADR-0006](decisions/0006-documentation-ownership.md)           | Blanket ADR triggers superseded by ADR-0008; remaining provisions apply                                                       |
| Independent connections                                         | [ADR-0007](decisions/0007-independent-project-connections.md)   | Source-resolution mechanics deferred                                                                                          |
| Documentation lifecycle                                         | [ADR-0008](decisions/0008-documentation-lifecycle.md)           | Operational policy in [governance](governance.md)                                                                             |
| Hard/soft-edge axiom retirement                                 | [ADR-0009](decisions/0009-retire-hard-soft-edge-axiom.md)       | Retirement applies; the dependency-metadata discussion reflects pre-Pure-Block behavior.                                      |
| Durable configuration identity                                  | [ADR-0010](decisions/0010-project-identity-configuration.md)    | Read/init lifecycle implemented; connection checks deferred                                                                   |
| Public Pure Block integration                                   | [ADR-0011](decisions/0011-public-pure-block-integration.md)     | Concrete engine and caller replacement                                                                                        |

## Terms used in this guide

A Block owns authored content; a Tag classifies a whole Block. An output set maps existing sources to
files and adds no primitive. A source instance is an evaluation context, not a persisted analysis
handle. A namespace snapshot carries metadata; a project connection supplies authored source.

## Historical evidence

[Repository assessment](history/2026-10-repository-audit.md) and
[private checkpoint evidence](history/2026-10-pure-block-checkpoints.md) retain dated observations.
[Legacy PRD](history/legacy-cli-prd.md) and [decision journal](history/legacy-cli-decisions.md) are
nonbinding historical material. Accepted records retain their original paths.
