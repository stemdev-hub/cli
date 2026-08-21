# Stem Decisions Journal

## Core Architecture Decisions

Stem is file-based because Git should be the source of truth. A database would create an export/import workflow and split ownership between files and hidden state.

The CLI is a thin shell. All real behavior belongs in `src/core`, which future MCP servers, UI tools, and editor integrations can import without CLI dependencies.

Operations orchestrate modules. Parser, graph, cache, and validator modules do not call each other directly, which keeps dependency direction simple and prevents circular runtime imports.

Parser functions take strings rather than file paths, graph builders take parsed data rather than paths, and validators are pure read-only functions. This keeps each module independently testable and prevents accidental writes during `stem check`.

## File Format and Storage Decisions

Markdown plus YAML frontmatter was chosen because developers already understand it and it fits docs-as-code workflows.

Folders define roles: `/blocks` contains canonical content, `/views` contains composed documents, and `/.stem` contains system metadata.

Blocks are containers, not typed objects. Tags activate behavior so teams can build their own taxonomy without changing the storage model.

Sections exist because related tagged content often needs a shared conceptual boundary. Tags may also use `section=` to bind content to a section from outside its physical boundary.

Schemas live in `/blocks/schemas/` rather than `/.stem/schemas/` because they are user-facing, version-controlled project documents, not hidden system metadata.

`.stem/config.json` replaced earlier `.stemrc` ideas. The `.stem/` folder marks the project root, and `config.json` keeps the version marker explicit without introducing a second root marker.

Config loading lives in a dedicated `core/config` module because it combines file reading, shape checks, default resolution, and path normalization. The filesystem module stays focused on file access, while operations and future public API consumers can use already-resolved config without knowing how it was loaded.

If `.stem/` exists but `.stem/config.json` is missing, Stem uses defaults. The project root marker is the folder, not the JSON file, and default config keeps newly initialized or minimal projects lightweight.

Config paths are project-relative POSIX strings. Absolute paths and `..` segments are rejected so project configuration cannot silently escape the repository.

## Graph and Cache Decisions

The connection graph is dynamic and is never written into block or view source files. This avoids merge conflicts caused by automatic backlink updates.

Circular `depends-on` relationships are warnings rather than errors because dependency edges are staleness relationships, not rendering relationships.

The cache uses hybrid stat plus SHA invalidation. `dev` and `inode` are stored as strings to avoid 64-bit truncation, and `mtimeMs` is treated as an integer to avoid cross-filesystem comparison drift.

Pure SHA invalidation was rejected because it requires reading every file before deciding whether parsing can be skipped. Pure mtime invalidation was rejected because Git operations can change mtimes without changing content.

## Graph Layer Decisions

The graph builder creates edges to missing nodes because its job is to faithfully represent what the files say. The validator decides whether those relationships are valid. Mixing those responsibilities would make both graph construction and validation harder to test.

Cycles in `block-depends-on` edges are warnings rather than errors because tightly coupled blocks may legitimately need to be reviewed together whenever either changes. A hard error would block useful documentation workflows.

Content embedding cycles are impossible by design: views embed blocks, but blocks do not embed other blocks. Dependency cycles describe maintenance relationships, not render-time transclusion.

Traversal functions are pure and operate only on a provided `StemGraph`. They do not read files, mutate graph state, or cache hidden results, which keeps dependency traversal independently testable.

Multiple filtered references from one view to the same block create multiple edges because each `section=` and `tag=` filter is a semantically distinct relationship. Collapsing them would lose precision needed by validators and renderers.

`GraphBuildResult` and `GraphBuildIssue` stay in `core/graph/types.ts` instead of `core/types/` because they are internal to graph construction. Exposing them through the shared type barrel would leak implementation details to public consumers.

## Validator Layer Decisions

The validator defines its build-issue input shape locally instead of importing `core/graph/types.ts`. TypeScript structural typing keeps graph build issues compatible while preserving the dependency rule that validator imports only shared core types.

Broken reference checks use `ParsedView.blockRefs` rather than graph edges because block refs retain `raw` text and source positions for precise diagnostics. Graph edges intentionally keep only relationship metadata.

Cycles and orphaned blocks are precomputed by operations because the validator must not import `core/graph/traverser.ts`. Operations can call traversal helpers and pass plain arrays into the pure validator.

Schema loading is an operations responsibility. The validator receives an in-memory schema map and performs no file I/O, which keeps schema rules independently testable.

Parser errors pass through operations separately because they are produced before the graph exists. The validator only reports issues it can derive from the graph, parsed files, build issues, precomputed traversal results, and schemas.

## Cache Layer Decisions

Unsupported cache versions return empty cache state rather than errors. Cache files are always regeneratable, so blocking operations for a version mismatch would add friction without protecting source data.

`metadataChanged` is separate from `unchanged` because operations need to update cache metadata after Git checkouts or filesystem timestamp changes without triggering a reparse. Folding that case into `unchanged` would lose the information needed to refresh the cache entry.

Conversion helpers live in `core/cache` because cache owns the persistence shape. `toCachedBlock` and `toCachedView` convert in-memory parsed objects into serializable records without importing parser implementation code.

`FileStats` lives in `core/types/cache.ts` because normalized stats are a shared contract between filesystem reads, cache invalidation, and future operations. Keeping it local to `core/fs` would make cache depend on filesystem implementation files just to reference the stat shape.

## Operations Layer Decisions

Operations return `OperationResult<T>` rather than throwing for expected project, config, filesystem, cache, schema, conflict, and invalid-operation failures. This keeps the CLI thin: commands pass options into operations and format typed success or error results.

`stem check` parses current source files directly and never writes cache files. This preserves full source-position diagnostics and keeps the command safe for CI and pre-commit use.

`stem sync` is the cache-writing operation. It reads the cache index, runs hybrid invalidation, parses only added or changed files, reuses cached parsed records for unchanged files, writes `.stem/cache/index.json`, and writes the graph snapshot.

List operations load the parsed in-memory graph without loading schemas. Listing should expose project metadata even if a schema file is temporarily invalid; schema correctness remains the job of `stem check`.

Mutating operations edit source files only: create writes block/view scaffolds, add appends view references, delete removes block/view files after reference checks, and rename rewrites block IDs plus references. They do not update `.stem/cache/`; users run `stem sync` when they want to refresh regeneratable cache state.

## Type System Decisions

Cached types and in-memory parsed types are separate. Cached types are serializable and omit positions; parsed types include positions for diagnostics.

Validation issues use discriminated unions so each issue code has an exact typed context.

All cross-module type imports use `import type`, and `src/core/types/index.ts` is a type-only barrel.

## Tech Stack Decisions

TypeScript and Node.js were chosen for ecosystem fit and strong support for CLI and Markdown tooling.

ESM is used throughout because it is the modern Node.js package standard.

`commander.js` is the CLI framework because Stem has a clear command tree and does not need a heavy plugin CLI framework for MVP.

`remark` and `unified` were chosen for Markdown AST parsing and future rendering compatibility.

`gray-matter`, `fast-glob`, `vitest`, `eslint`, `prettier`, `tsup`, and `pnpm` were chosen as current TypeScript CLI project standards.

## Post-Research Validation Decisions

Gemini research validated that file-mutating graph metadata is risky at scale. Stem therefore keeps backlinks and graph snapshots out of source files.

Research also clarified that pure SHA caching reads too much data. The final design mirrors Git-style stat checks before hashing.

Two-pass parsing is required because tags can bind to sections that appear elsewhere in the file.

The parser must ignore fenced code blocks and inline code spans so Stem can document its own syntax.

`stem rename` is MVP because manual ID edits would otherwise break every reference.

`stem check` and `stem sync` are separate because `check` must be safe in CI and never modify files, while `sync` intentionally updates regeneratable cache files.

Raw view files with `@stem[]` macros are accepted as an MVP tradeoff. Rendered preview and PR rendering belong post-MVP; source files stay explicit and powerful.

Stem renders to Markdown before HTML or static-site output. Markdown output keeps Stem focused on composition and lets projects feed generated files into MkDocs, Docusaurus, GitHub Pages, Pandoc, or any other publishing pipeline. HTML export, local preview servers, navigation generation, and link rewriting remain later features.

`stem preview` is a terminal authoring shortcut over Markdown rendering. It prints the same resolved Markdown as `stem render view --stdout` and does not introduce a browser, local server, or separate rendering path.

Market research compared Stem with DITA, Antora, Paligo, Swimm, Archbee, Structurizr, Obsidian, Dendron, and Logseq. The durable gap is the combination of Git-native Markdown, dynamic graphing without file mutation, section/tag filtered transclusion, and progressive enhancement for developer teams.

## Parser Implementation Decisions

### Validated MVP plugin strategy

A focused spike validated a post-parse Remark transform for MVP. Stem uses `unist-util-visit` as a direct runtime dependency to visit mdast `text` nodes and replace recognized `@stem[...]` ranges with typed AST nodes. This is smaller than a micromark extension while Stem syntax remains a compact project macro rather than a new Markdown block grammar.

The spike correctly recognized all ten supported directive forms, including filtered block references and scoped dependencies. It rejected empty, colonless, and unknown-type directives, and retained unknown parameters without changing the parsed known fields.

### Code isolation and Markdown stability

Code isolation is structural: fenced code blocks are `code` nodes and backtick spans are `inlineCode` nodes, while the plugin visits `text` nodes only. The spike found zero custom Stem nodes inside either code form and preserved the baseline heading, paragraph, and list counts.

### Production parser boundary

The spike validated syntax-node transformation before production implementation. The production parser combines `gray-matter` frontmatter extraction, the Remark plugin, and two-pass section/tag binding, returning recoverable issues rather than throwing. Parser functions accept content and path metadata; file reads remain outside `core/parser/`.

### Known MVP guardrail

The production regular expression prohibits `@stem[...]` matches that cross line boundaries. Parameter values stay intentionally compact for MVP; they cannot contain spaces or `]`. A later micromark extension remains the path for substantially richer syntax.

## Rejection of Block Aliases for Reference Resolution

**Context:** As documentation grows, blocks are often renamed. Systems like Obsidian use frontmatter `aliases: []` to map old names to the new note, preventing broken links. We considered adding this to Stem to ensure `core/graph` resolution doesn't break when a block is renamed.

**Decision:** We will **not** use `aliases` for internal reference resolution.

**Rationale:**
Stem is a Git-native, "Documentation as Code" tool. In software engineering, when a variable or file is renamed, developers rely on refactoring tools to update all usages, rather than leaving the old name as a permanent alias. Stem already provides the `stem rename <old> <new>` CLI command to safely update all references in the graph. Introducing aliases for backwards compatibility would encourage "reference rot," where documentation is littered with deprecated links instead of being actively refactored.

_(Note: Aliases may eventually be introduced strictly as a "Search Keyword" index for AI agents via the MCP Server, but they will never be used by the core graph builder to resolve internal `@stem[...]` references)._

## Cross-Project Reference Architecture (August 2026)

**Publish and Cache:** Stem uses a "Publish and Cache" model (`stem publish-graph` and `stem fetch-namespaces`) for cross-project references. We rejected Approach A (Lazy Warn) because it provides no path to structural validation (section/tag checks fail silently locally). We rejected Approach C (Registry Service) because it requires a running service, violates the Git-native principle, and breaks offline/air-gapped environments. The published artifact is a lightweight `ExternalStemGraph` JSON file.

**Local Validation Strictness:** Cross-namespace references produce warnings locally and errors in CI (via `--strict-external`). Network I/O is excluded from `stem check` because it must remain a pure, fast, deterministic local operation. We split the generic `UNRESOLVED_EXTERNAL_REF` warning into three distinct codes (`UNRESOLVED_NAMESPACE`, `MISSING_SNAPSHOT`, `EXPIRED_SNAPSHOT`) to preserve diagnostic signal and ensure CI error messages are actionable (e.g., distinguishing a typo from a missing `stem fetch-namespaces` step).

**Snapshot Content:** The `ExternalStemGraph` snapshot explicitly excludes block prose content, full dependency graphs, and internal file paths. This keeps the artifact extremely small (<50KB) for fast fetching, and avoids exposing proprietary content or triggering licensing concerns across boundaries. A `contentSha` field is included as the mechanism for the deferred `stem diff-namespace` feature to detect local drift without comparing individual block lists.

**Resolution Priority:** When both `localPath` and `graphUrl` are configured for a namespace, `localPath` takes priority to support sibling-repo/monorepo local development. However, `graphUrl` is always fetched during `stem fetch-namespaces`. The `--use-remote` flag can force fallback to the remote snapshot.

**Stale Renames:** When a remote block is renamed, we explicitly reject "fuzzy matching" to hint at the new name. Fuzzy matching introduces non-determinism. Instead, the snapshot includes a `renames` array. A renamed remote block is treated as a breaking API change that consuming projects must adopt based on this explicit metadata.

**Namespace Naming Rules:** Namespace aliases must be kebab-case (alphanumeric and hyphens). We explicitly rejected dots (reverse-domain style like `com.example.api`) because dots require escaping in `grep` patterns and introduce parser ambiguity risk for future grammar extensions.

**Auth Model:** `stem publish-graph` relies on Ambient CI credentials (OIDC) to authenticate with object storage (S3/GCS). We chose this as the primary model to avoid secret management. Per-repo service account keys (via environment variables) serve as a fallback for CI environments without OIDC support.

## Post-MVP Ideas

Post-MVP work includes `stem diff-namespace`, MCP support, UI composition, VS Code integration, rendered previews, CI rendering, live code references, external source references, parameterized blocks, aliases, and localization.
