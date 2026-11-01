# Current Stem reference

This describes the coordinated Pure Block implementation. [Specifications](architecture.md#pure-block-design)
own detailed contracts; [roadmap](../roadmap.md) distinguishes implementation, host acceptance and release.

## Files and frontmatter

`blocksDir` (default `blocks`) is the single project-relative Markdown source directory.
Files may contain multiple nested Blocks and surrounding text, or no Blocks. Frontmatter is ordinary
text and supplies no Stem identity. Existing authored View files are preserved; authors decide whether
to include them in the source layout. `viewsDir` is an unknown configuration key.

Discovery includes lowercase `.md` files recursively and excludes hidden files/directories,
`node_modules` and `dist`. Physical source paths must remain within the source directory and project.
A destination's output manifest does not establish a source project.

## Body markers and classification

A definition uses `@stem:block(id:example tags:[guide, "API notes"])` and `@stem:end(id:example)`.
Missing/invalid identity is diagnosed and cannot be selected by ID.
An unlabelled `@stem:end()` closes the innermost Block. Nested Blocks own their own content and Tags.
IDs use ASCII letters, digits, underscore and hyphen, preserving case. Duplicate IDs remain separate
recovered definitions and make ID selection ambiguous. Tags classify whole Blocks, never fragments;
matching uses NFC equality and never inherits Tags from a parent. See [syntax](specs/stem-syntax.md)
for exact metadata grammar, escaping, standalone boundary handling and recovery.

## References and selection

`@stem:include(example)` expands the selected Block's body and descendants. Repeated inclusions
remain repeated. Surrounding source text is preserved when composing a file. Block selection excludes
its authored boundaries; file selection composes the entire source. Unrelated definition errors do
not block an otherwise eligible selected result. A cycle stops the affected expansion and reports
an error while preserving other available content.

```markdown stem-check=composition-source
@stem:block(id:welcome tags:[guide])Welcome.@stem:end()
@stem:block(id:page)@stem:include(welcome)@stem:end()
```

Selecting Block `page` yields exactly:

```text stem-check=composition-output
Welcome.
```

Qualified references use `alias:id` within the defining instance's context. Core accepts caller-supplied
source instances. CLI/editor connection resolution is deferred: configured namespace metadata cannot
supply bodies, so a qualified inclusion without authored source remains unavailable.

## Parameters and placement

Legacy Section/Tag-fragment selectors, parameter substitution and View APIs are retired directly.
Use nested Blocks for selectable content. Escaping and placement are specified in
[Stem syntax](specs/stem-syntax.md); generated text is never rescanned for directives.

## Validation and diagnostics

Checking and listing use fresh sources and return usable recovered data alongside diagnostics.
Block rows identify their source and original UTF-16 range; an unusable ID is absent. Reference lookup
returns authored occurrences, including repeated and file-level inclusions, with explicit completeness.
These ranges describe one evaluation and must not be persisted as identity.

Output-use warnings concern local Blocks unreachable from all configured outputs through containment
and inclusion. Library projects need no output roots. Incomplete reachability suppresses misleading
unused-Block warnings. Checking exits nonzero for errors; listing also fails for incomplete results.
Warnings alone do not fail a completed query. JSON retains the operation envelope and diagnostics.

Preview returns exact current content, including partial content, and reports diagnostics separately.
Normal export requires a complete result without applicable errors. Neither preview nor stdout export
adds a newline. Reads and previews write no sources, configuration, caches, manifests or locks.
Composition limits and override semantics have one owner in [D24](specs/composition.md#d24-resource-budgets).

## Output publication

`outputSets` maps explicit Block/file selectors to destination paths and effective policies. It is
optional; an empty library project is valid. File selectors are project-relative beneath `blocksDir`.
Destination paths are relative to a set's output directory, which defaults to the project root.
`ifExists` defaults to `replace`; `skip` preserves existing bytes and ownership; `error` refuses them.
`cleanup` defaults to `keep`; `prune` requires a complete successful selection and safe ownership checks.

Publication validates the whole selected destination plan before writes, protects sources and metadata,
and coordinates local writers per physical output root. Each root's `.stem/outputs.json` records producer
identity, set, path and exact-byte hash. A confirmed file publication remains published when later
tracking fails; results retain partial successes and stage-specific errors. No batch transaction is claimed.

Explicit cleanup assesses by default. Applying cleanup removes only unchanged obsolete files owned by
the current project/set. Current targets in all sets remain protected, including during retired-set cleanup.
Edited, unowned or unsafe files remain. See the [publication contract](specs/composition.md#d25-export-eligibility-and-publication).

## Tag-schema retirement

Tag-schema YAML is not loaded or enforced. Existing YAML files are preserved. Markdown in former schema
directories follows ordinary discovery. Replacement schemas/templates remain deferred.

## Configuration validation

Configuration lives in `.stem/config.json` and rejects unknown keys at every supported level.
Supported root keys are `projectId`, `blocksDir`, `cacheDir`, `outputSets`, `namespace`, `publishUrl`
and `namespaces`. There is no version field. See the [CLI configuration example](../packages/cli/README.md#configuration).

### Project identity

`projectId` is a required canonical lowercase UUIDv4. Reads never generate or repair it. New initialization
creates identity; force initialization preserves valid existing configuration bytes and completes missing
scaffolding. Invalid configuration fails before writes. Restore a lost configuration from version control
when the original project identity must be retained.

## Namespace snapshots

Metadata exchange remains separate from authored-source connections. `publish-graph` sends version `2`
Block-only metadata with project identity, flat IDs/direct Tags and advisory rename history. Invalid
classification/identity prevents projection. It includes no source bodies, sections, positions or handles.

`fetch-namespaces` retains explicit HTTP metadata retrieval. By default, a namespace's `localPath` first tries
`.stem/cache/stem-graph.json`; otherwise consumers use `.stem/cache/namespaces/<alias>.json` containing
`{ fetchedAt, graph }`. `stem check --use-remote` bypasses local lookup and uses cached remote metadata; it does not download a fresh snapshot. Core owns pure envelope decoding and shape validation; adapters own I/O and
fallback. Timestamp strings remain permissive. Remote snapshots older than seven days warn (errors
under strict external checking); local fallback bypasses expiry. Rename history is advisory only.

The local external-snapshot producer is absent. Internal sync `graph.json` is a different, disposable
position-free format. Sync parses every discovered source; it does not reconstruct legacy caches.
Connection storage, Git transport and connection-resolution lifecycle remain deferred under
[ADR-0007](decisions/0007-independent-project-connections.md).
