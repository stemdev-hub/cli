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

These examples describe the accepted contracts, not the current implementation.
