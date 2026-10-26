# Pure Block model

Status: accepted (23 October 2026), by explicit owner acceptance of revision `a56203e`.
Implementation remains pending. Governing decision:
[ADR-0005](../decisions/0005-pure-block-model.md). See
[architecture](../architecture.md#proposed-pure-block-design) for document ownership and D-label
navigation.

## D1. Authored content

A Block is a unit of authored content that may contain content, child Blocks, or both. Internal
formatting does not automatically create additional domain Blocks.

## D2. Subtree selection

Selecting a Block selects its own content and its recursively owned children. Selecting a child
targets that smaller subtree.

## D3. Roots and files

A file may store multiple independent root Blocks; one root per file is an organizational
convention. A root is an ordinary Block without a containment parent. Files are storage containers,
not implicit Blocks; semantic grouping uses an ordinary parent Block.

A source file may contain no Block definitions. Document assemblies use ordinary Blocks with text
and inclusions, or whole-file composition; there is no separate Page type or definition-free source
role. [Output sets](composition.md#output-sets-and-targets) select these existing sources and assign
destination paths without creating content identity.

## D22. Surrounding content

Ordinary Markdown may exist outside Blocks and remains outside the Block domain. Only Block
definitions participate in Block lookup, classification, and inclusion selection; selecting a Block
does not include surrounding text. Whole-file composition preserves surrounding Markdown and emits
definitions and inclusions under [D11](composition.md#d11-inclusion). File-level frontmatter is
ordinary surrounding content under the [syntax policy](stem-syntax.md#file-level-frontmatter), not
Block metadata or an implicit Block. Intended Blocks with missing or invalid IDs remain errors,
not ordinary-content fallbacks.

## D4. Durable identity

Every domain Block has a mandatory, durable ID unique across its project, including all descendants.
Identity is independent of file location and preserved in versioned source.

## D4a. Identity through edits and moves

Content edits and moves between files or parents within the project preserve IDs.

## D4b. Independent copies and transclusion

Independent copies receive new IDs for the copied Block and all copied descendants; transclusion
references existing identity without creating another definition with that ID.

## D4c. Duplicate and missing IDs

Multiple definitions carrying the same valid, single ID within one resolved project instance
([D5](project-connections.md#d5-reference-context-and-project-aliases)) make lookup ambiguous: report
the conflict and choose none, even if only one definition is otherwise valid. Selecting multiple
instances or revisions of a project does not itself duplicate its definitions.

A missing, malformed, or repeated `id:` field invalidates that definition and makes it unaddressable
by ID. Preserve its recovered content for source preview; reads neither invent durable identity nor
choose among repeated fields. A unique valid ID remains addressable when other definition errors
exist, subject to [D10](#d10-id-and-tag-selection).

### Definition handles

Project analysis retains each recovered definition independently of its authored ID. Use temporary
analysis-local handles or object references to distinguish definitions with duplicate, missing, or
invalid IDs; do not overwrite candidates in an ID-keyed lookup. These handles are not new durable
identities, are not persisted, and cannot be used as cross-analysis references. They need no public
UUID or serialization format.

A resolved target or selection match retains both its definition handle and resolved project
instance context. Equal source text may share parsed syntax while being interpreted in different
instances under [D5](project-connections.md#shared-content-and-duplicate-connections). Authored ID,
temporary definition handle, and resolved-instance identity remain distinct.

### Source editing

Deleting a selected Block removes only its definition and contained subtree, preserving sibling
definitions and surrounding text in the file. A Block deletion is not a file deletion. Reference
checks cover the selected Block and its descendants, since each descendant is independently
addressable. Existing reference-conflict safeguards must apply to that whole removed subtree.

Renaming an ID edits its recognized definition token, matching labelled closer and references
resolved to that definition in the supplied context. It preserves filenames, descendant IDs,
unrelated references, literal examples and other authored text. An equal ID spelling in another
instance is not sufficient to select a reference for rewriting. Use the parser's original-source
token ranges rather than rewriting frontmatter or searching and replacing arbitrary text.

Reject ambiguous selections. Refuse destructive edits when recovery leaves the affected ownership
or edit boundaries uncertain; neither a guessed range nor a whole-file fallback is acceptable.
Adapters own filesystem reads and writes; this contract does not introduce another parser in them.

#### Authoring operations and destinations

These Node/CLI replacement contracts await coordinated implementation. Source-file destinations
are explicit project-relative Markdown paths within the current project's `blocksDir`; Block
destinations select one local definition. Reject missing/ambiguous Block destinations, paths outside
the source boundary, and uncertain ownership or insertion ranges. Do not edit connected projects.
Filesystem resolution must preserve that boundary rather than trusting path spelling alone.

Retain `createBlock` with an explicit ID and destination. CLI creation uses
`stem create block <id> --file <path>` or `stem create block <id> --parent <id>` (exactly one),
with repeatable `--tag <tag>` for direct classification. Validate the supplied ID with the shared
grammar, preserving spelling without trimming, slugging or appending `-block`; reject collisions
with existing addressable definitions. Emit ordinary Block syntax with an explicit closer, not
frontmatter or Tag-owned content. Validate and encode Tags under D27/D29 without inventing templates.

For a file destination, create a missing file without overwriting a concurrent creator, or append
a root definition at the existing file's end. For a parent destination, insert a final child before
its actual closer. An open definition at EOF cannot silently turn an intended new root into its
child; an implicit/recovered ending is not permission to invent a closer. Refuse unsafe insertion.
Preserve all existing source text; insert only the new definition and necessary line separators.

Replace `addBlockToView` with `addInclusion`. CLI uses `stem add <ref> to block <id>` or
`stem add <ref> to file <path>`. Validate and resolve the reference in the destination's context
before inserting `@stem:include(<ref>)`; unavailable or ambiguous targets are operation failures.
Append within the selected Block before its actual closer, or at the end of an existing source
file in surrounding-content scope, using the same insertion safeguards. Do not rewrite existing
text, expand the target, or retain Section/Tag selection flags. Repeated inclusions are permitted.

Retain `deleteBlock` and `stem delete block <id> [--force]`. Remove only the selected definition
and subtree; leave the containing file even if it becomes empty. Check references from surviving
local source and the [configured output targets](composition.md#output-selectors-during-authoring)
to every removed descendant. References wholly inside the removed subtree are not surviving
conflicts. Without force, report conflicts before writes. Force may leave known references dangling,
but never bypasses ambiguous selection, uncertain boundaries or an incomplete safety assessment.
Report affected surviving references; do not silently remove or retarget them.

Retain `renameBlock` and `stem rename <old-id> <new-id>`. Require a unique local selection and a
valid, noncolliding replacement ID; renaming to the same ID is a no-op. Apply the token edits above
and update matching local output selectors under their contract. Preserve filenames, child IDs,
explicitly escaped Stem syntax and equal spellings that resolve to other instances. Retain `.stem/renames.json`
as advisory rename history, not an alias resolver. Validate existing history before source writes;
report malformed/unreadable history rather than silently replacing it. Record the completed rename
after source/configuration edits; a history-write failure must retain those edits in the result.

Retire `createView`, `createGroup`, `deleteView`, their CLI commands, and View-specific option/result
fields without aliases. Ordinary source files and parent Blocks supply those authoring roles;
creation does not automatically add an output mapping. Initialization follows the
[source-transition contract](composition.md#source-boundary-and-view-retirement).

#### Mutation preparation and failures

Plan and validate the whole requested edit against fresh source/configuration before writing.
Use original token ranges; reject overlapping or uncertain edits and recovery that prevents
identifying references relevant to the requested edit. Recheck relevant inputs before
publication and each affected file before its write; detected changes stop remaining writes rather
than applying stale ranges. Reuse the shared safe writer and create-only mode for new files.
These checks do not establish a filesystem compare-and-swap or a project-wide transaction.

Report overall success, confirmed changed files and the failing stage on partial failure, including
configuration or rename-history writes. Stop after a failed write; do not claim previous writes were
rolled back or overwrite later edits in an automatic rollback. No mutation implicitly renders,
syncs computation caches, updates ownership manifests or prunes outputs. Concrete declarations
must preserve these outcomes even when the operation reports failure.

Acceptance covers root/child insertion, ID/Tag validation, collisions, ambiguous/recovered input,
sibling and surrounding-text preservation, descendant reference conflicts and force limits,
token-only rename, output-selector effects, corrupt history, changed inputs and late write failures.

## D6. Containment parenthood

Each Block has at most one containment parent; containment is acyclic. Transclusion does not
establish parenthood.

## D7. Containment storage

Children stay inside their parent; each complete containment tree is stored within one file.
Cross-file reuse uses references.

## D8. Authored order

A Block preserves the authored order of its own content and child Blocks, including their relative
placement; children are not regrouped separately from content.

## D9. Direct classification

A Block may have zero or more directly attached Tags, and a Tag may classify many Blocks. Tags do
not propagate to ancestors or descendants; subtree selection does not imply inherited
classification. Tag identity is project-scoped: equal names across projects do not identify the same
Tag, and included Blocks retain their originating project's Tag identities.

## D10. ID and Tag selection

ID selection targets one Block and its subtree; Tag selection returns a collection of directly
tagged Blocks. Both operate within the selected resolved project instance
([D5](project-connections.md#d5-reference-context-and-project-aliases)), without combining Block
definitions or Tag memberships from different instances or revisions. Transclusion targets Blocks by
ID; automatic composition of Tag matches is rejected because classification supplies no ordering or
assembly rules. Ordered assemblies use ordinary Blocks with references.

Selecting a uniquely identified erroneous Block preserves usable preview content with its
diagnostics. A selected subtree includes errors in its descendants. Independently selecting a child
does not inherit an ancestor's metadata errors unless they affect that child's ownership or content
interpretation. A correctly bounded child can therefore remain usable when its parent has invalid
metadata. [D25](composition.md#d25-export-eligibility-and-publication) governs export eligibility for
the selected result.

Tag selection returns known matches from unambiguously parsed Tags. If incomplete classification in
the searched scope leaves additional matches unknown, return an explicit incomplete-classification
diagnostic with those matches; do not report the collection as exhaustive. Tag recovery follows
[D28](stem-syntax.md#d28-tag-diagnostics-and-recovery). Classification completeness, composed-content
completeness, and definition validity are distinct; an invalid Tag list need not make body text
incomplete.

### Selection results

`findBlocksByTag()` returns an object with readonly `blocks`, `classificationComplete`, and
`diagnostics`. No separately named result type is required.
The `blocks` collection contains known matches, retaining the definition and instance context
described [above](#definition-handles), including Blocks with definition errors.
The Boolean `classificationComplete` states whether classification is exhaustive in the searched
scope, not whether the definitions are valid or their composed content is complete. An empty,
exhaustive result has `classificationComplete: true`; known matches with potentially unknown
additional matches have `classificationComplete: false` and an incomplete-classification diagnostic.
The collection supplies no automatic assembly order under D10.
ID-reference selection uses [BlockResolution](project-connections.md#block-reference-resolution).

## D29. Tag names and equality

Tag names are text, with no implicit number, Boolean, or null conversion. Preserve internal spaces.
Validate names after decoding quoted escapes: empty names, control characters, and line breaks are
errors, including when produced by escapes; leading/trailing whitespace inside quoted names is also
an error rather than silently trimmed. Tag equality uses case-sensitive comparison of decoded names
after [Unicode NFC normalization](https://www.unicode.org/reports/tr15/tr15-58.html); authored
source is preserved.

## Project analysis

Retain `ProjectSnapshot`, `analyzeProject()` and `ProjectAnalysis`. A snapshot supplies unified
`SourceDocument` inputs and their project/instance context, replacing the legacy Block-file/View-file
split. It is an evaluation input, not a persisted format. Its ownership and lifetime follow
[D20](composition.md#d20-evaluation-inputs); source binding and instance semantics follow
[D5](project-connections.md#d5-reference-context-and-project-aliases).

`ProjectAnalysis` retains parsed sources, recovered definitions and project-wide diagnostics.
Parsing remains independent of project interpretation under the
[parser contract](stem-syntax.md#parser-contract). Lookup indexes are private derived data; do not
make mutable index maps a public storage contract. Project checking can report the full diagnostic
set, while selection and composition retain their own diagnostic scope. Analysis returns useful
data alongside diagnostics rather than a single success/failure result.

### Read-only CLI and MCP queries

The following are replacement contracts under ADR-0005, awaiting coordinated implementation.
Node operations retain `OperationResult` envelopes; source-dependent queries use fresh analysis.
Configuration and loading failures remain operation errors. Completed queries retain usable data and diagnostics
even when authored content has errors. Results and nested collections are readonly. Queries never
write sources, configuration, computation caches, output files, manifests or locks.

CLI JSON output must retain the query's diagnostics and completeness information, not reduce a
result to an array of matches. MCP tools use the success/error envelope and structured/text
agreement described for [MCP preview](composition.md#mcp-preview), advertise `readOnlyHint: true`,
and set `isError` for operation failures, not merely for diagnostics in a completed query. CLI
queries exit nonzero for operation failures or returned error diagnostics; listing/reference-query
incompleteness also exits nonzero. Warnings alone do not fail a completed query.

#### Block listing

Retain `listBlocks`, `stem list blocks [--tag <tag>] [--json]` and MCP `list_blocks` with optional
`tag`. List local recovered definitions, including nested, duplicate and invalid definitions,
without including connected projects' inventories implicitly. Each row identifies its source file
and definition range, its ID when usable, and known direct Tags. An unusable ID is absent rather
than fabricated; duplicate valid IDs remain separate rows distinguished by source locations.
Order rows by project-relative source path and then definition start offset. These locations
describe the current source and do not establish durable identity.

Remove `usedInViews`, `sectionCount` and `standaloneTagCount`. Return the rows, their total,
`classificationComplete` and diagnostics. Tag filtering uses shared core selection and D29 equality;
retain known matches with incomplete classification under [D10](#d10-id-and-tag-selection).
An exhaustive empty result is distinct from an incomplete search. Listing gives no assembly order.

#### Reference lookup

Use `listReferences`, `stem list references <id> [--json]` and MCP `list_references` with required
`id` to preserve the useful reference lookup formerly offered by `list views --block`.
Select one local Block through core resolution; missing, invalid or ambiguous selection is an
operation failure, never a first-match choice. Return authored inclusion occurrences in the local
source scope that resolve to that definition and instance, with source paths/ranges and an owning
Block when present. Include file-level occurrences without inventing an implicit Block. Repeated
authored references remain separate occurrences; transitive expansion creates no extra occurrences.

Return known references with explicit completeness and diagnostics when recovery or unresolved
references prevent an exhaustive assessment. Equal ID spelling in another instance is not a match.
Containment and configured output mappings are not authored inclusion occurrences; an empty result
does not prove that a Block is unused. [Output reachability](#blocks-outside-configured-outputs)
owns that separate assessment, while [output discovery](composition.md#output-discovery) exposes
configured mappings. Retire `listViews`, `stem list views` and `list_views` without aliases.

#### Checking and Block source retrieval

Retain `checkProject`, `stem check [--json]` and MCP `check_references`. Report shared project
diagnostics, including applicable [output-usage warnings](#blocks-outside-configured-outputs),
with severity counts and validity summaries derived from those diagnostics. A completed check
with content errors remains an evaluated operation result; the CLI exits nonzero for errors.
Warnings alone, including an incomplete output-usage assessment, do not fail checking. Retained
external-snapshot adapter options keep their separately specified scope.

Retain MCP `stem://blocks/{id}` for a uniquely selected local definition. Return exactly its original
source range, including authored boundaries and children, without expansion, normalization or an
appended newline. Use the same source content that was analyzed, not a second file read. Preserve
the parser's recovered range and actual source spelling without synthesizing a missing closer.
Missing/ambiguous selection, unavailable source or an unavailable range is a resource failure;
never return another candidate, adjacent siblings or the containing file as a fallback.

Acceptance covers nested/duplicate/invalid definitions, incomplete Tag classification, source order,
repeated and file-level inclusions, scope/completeness reporting, exact Block source extraction,
CLI/MCP data agreement, warning-only checks and absence of writes. Current guides and generated
declarations change with runtime integration, not this contract checkpoint.

### Graph construction and checking

Retain `buildGraph()`, `validateGraph()` and `detectCycles()` with replacement representations.
Graph nodes distinguish recovered definitions by their analysis-local handle and supplied instance
context, including definitions with duplicate or invalid IDs. Authored IDs remain lookup keys;
they are not unique graph storage keys. Keep all duplicate candidates without selecting a winner.
Public graph records and collections are readonly; mutable lookup indexes remain private.

Graph relationships describe containment and inclusion, replacing View-use and legacy
dependency-review edges. Unresolved inclusions retain their occurrence and diagnostic rather than
an invented target. File-level inclusions remain represented without turning the file into a Block.
Graph checking uses the shared core cycle mechanism under
[D12](composition.md#d12-expansion-cycles); composition retains its own active-path traversal.

### Blocks outside configured outputs

Retain `getOrphanedBlocks()` as an output-reachability query. It consumes the supplied graph and
roots derived from every target in all of the current project's configured
[output sets](composition.md#output-sets-and-targets), not just targets selected for one render run.
Core performs no configuration discovery, file reads or composition to answer this query.

A Block target reaches its definition and contained descendants. A whole-file target reaches all
definitions and file-level inclusions in that source. Follow containment and resolved inclusions
transitively, retaining definition and instance identity. A child of a reached Block counts as used
without needing a direct output mapping. An unreachable cycle does not become used merely because
its members reference each other. Use stack-safe traversal with visited-node tracking; repeated
inclusions and cycles must terminate without expanding output text. Existing-file policies,
publication failures and composition budgets do not change this structural reachability question.

The query reports local candidate definitions, whether the assessment is applicable and complete,
and diagnostics, using readonly records and collections. Preserve duplicate/invalid definitions
individually rather than collapsing by authored ID. Traverse supplied connected instances when
needed, but do not warn about their unreached library Blocks or execute their output configurations.
No configured targets means the assessment is not applicable and produces no per-Block warnings.
Unavailable roots or unresolved/ambiguous references encountered on reachable paths make the
assessment incomplete; report that limitation and suppress per-Block unused-output warnings.

For a complete assessment, project checking emits `ORPHANED_BLOCK` with severity `warning` for
each local definition outside the reachable set, located at that definition. Describe it as
"not reachable from any configured output" and a possible left-out Block, not proven stale content.
This replaces the old View-use predicate. The warning does not make a Block invalid, block export,
establish absence of external consumers, or authorize automatic deletion. Pure parsing
and callers without supplied output context do not infer orphan warnings from graph edges alone.

Acceptance covers direct targets, nested children, transitive inclusions, whole-file roots,
unselected output sets, reachable/unreachable cycles and distinct instances. Verify no false
per-Block warnings for absent or incomplete output scopes, source-located warnings for complete
assessments, unchanged export eligibility and no writes during assessment or checking.

## D23. Schema retirement transition

This transition is accepted under [ADR-0005](../decisions/0005-pure-block-model.md).

Preserve user-authored schema files as ordinary files; do not automatically delete or convert them.
Validate configuration keys against supported fields and reject unknown keys using the existing
configuration-error code. This includes settings for removed features without maintaining a
retired-field lookup, compatibility handling or migration-specific diagnostics. This removal does
not remove the grammar, identity, reference, or composition validation required by the accepted specifications.

Initialization creates no schema directory or templates and preserves existing authored schema files,
including under force.
There is no special schema-directory exclusion from Markdown source discovery; YAML files are not
Markdown sources. Core exports and analysis inputs carry no retired Tag-schema types or fields.

[Roadmap D23](../../roadmap.md#d23-schemas-structural-validation-and-templates) owns implementation evidence and deferral of replacement schemas/structural validation/templates. ADR statuses record the completed partial supersession.

## Worked examples of selection

- Two definitions have `id:a`; one also has invalid Tag metadata. Lookup of `a` is ambiguous, rather than selecting the definition without the Tag error.
- A definition has `id:a id:b`. It remains visible in source preview but is addressable by neither ID.
- Parent `p` has an invalid Tag list and contains a correctly bounded, valid child `c`. Previewing `p` preserves usable content with the error; normal export of `p` is blocked. Independently selecting `c` can be exported if its own subtree and references are valid and complete, and the parent's error does not affect its interpretation.
- A recovered Tag list certainly contains `guide` but has an unreadable remainder. Selection for `guide` includes that known match with its diagnostics; selections whose additional matches may be unknown report incomplete classification.
- A definition has `tags:[guide] tags:[api]`. Both fields remain in the syntax representation, but neither supplies a chosen or merged membership; Tag queries report incomplete classification for the affected scope.
- A file contains sibling Blocks `a` and `b` with surrounding text. Deleting `a` preserves `b` and that text; renaming `b` changes its recognized identity/reference tokens without renaming the file.

These examples describe the accepted contracts, not the current implementation.
