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

## Graph and Cache Decisions

The connection graph is dynamic and is never written into block or view source files. This avoids merge conflicts caused by automatic backlink updates.

Circular `depends-on` relationships are warnings rather than errors because dependency edges are staleness relationships, not rendering relationships.

The cache uses hybrid stat plus SHA invalidation. `dev` and `inode` are stored as strings to avoid 64-bit truncation, and `mtimeMs` is treated as an integer to avoid cross-filesystem comparison drift.

Pure SHA invalidation was rejected because it requires reading every file before deciding whether parsing can be skipped. Pure mtime invalidation was rejected because Git operations can change mtimes without changing content.

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

Market research compared Stem with DITA, Antora, Paligo, Swimm, Archbee, Structurizr, Obsidian, Dendron, and Logseq. The durable gap is the combination of Git-native Markdown, dynamic graphing without file mutation, section/tag filtered transclusion, and progressive enhancement for developer teams.

## Parser Implementation Decisions

### Validated MVP plugin strategy

A focused spike validated a post-parse Remark transform for MVP. Stem will use `unist-util-visit` as a direct runtime dependency to visit mdast `text` nodes and replace recognized `@stem[...]` ranges with typed AST nodes. This is smaller than a micromark extension while Stem syntax remains a compact project macro rather than a new Markdown block grammar.

The spike correctly recognized all ten supported directive forms, including filtered block references and scoped dependencies. It rejected empty, colonless, and unknown-type directives, and retained unknown parameters without changing the parsed known fields.

### Code isolation and Markdown stability

Code isolation is structural: fenced code blocks are `code` nodes and backtick spans are `inlineCode` nodes, while the plugin visits `text` nodes only. The spike found zero custom Stem nodes inside either code form and preserved the baseline heading, paragraph, and list counts.

### Production parser boundary

The spike validates syntax-node transformation only. The production parser still combines `gray-matter` frontmatter extraction, the Remark plugin, and two-pass section/tag binding, returning recoverable issues rather than throwing. Parser functions accept content and path metadata; file reads remain outside `core/parser/`.

### Known MVP guardrail

The production regular expression must prohibit `@stem[...]` matches that cross line boundaries. The spike established the traversal approach and supported node shapes, but its prototype parameter tail does not by itself enforce this single-line grammar rule. A later micromark extension remains the path for substantially richer syntax.

## Post-MVP Ideas

Post-MVP work includes MCP support, UI composition, VS Code integration, rendered previews, CI rendering, live code references, external source references, parameterized blocks, aliases, cross-project blocks, and localization.
