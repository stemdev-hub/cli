# Pure Block model

Status: proposed. Working agreements, not accepted or implemented behavior. Governing decision:
[ADR-0005](../decisions/0005-pure-block-model.md) (proposed). See
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

## D22. Surrounding content

Ordinary Markdown may exist outside Blocks and remains outside the Block domain. Only Block
definitions participate in Block lookup, classification, and inclusion selection; selecting a Block
does not include surrounding text. Whole-file composition preserves surrounding Markdown and expands
Block inclusions ([D3](#d3-roots-and-files)). Intended Blocks with missing or invalid IDs remain
errors, not ordinary-content fallbacks.

## D4. Durable identity

Every domain Block has a mandatory, durable ID unique across its project, including all descendants.
Identity is independent of file location and preserved in versioned source.

## D4a. Identity through edits and moves

Content edits and moves between files or parents within the project preserve IDs.

## D4b. Independent copies and transclusion

Independent copies receive new IDs for the copied Block and all copied descendants; transclusion
references existing identity without creating another definition with that ID.

## D4c. Duplicate and missing IDs

Duplicate definitions within one resolved project instance
([D5](project-connections.md#d5-reference-context-and-project-aliases)) are ambiguous and reported,
never silently selected. Selecting multiple instances or revisions of a project does not itself
duplicate its definitions. Missing IDs make definitions incomplete/invalid; reads do not invent
durable identity.

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

## D29. Tag names and equality

Tag names are text, with no implicit number, Boolean, or null conversion. Preserve internal spaces.
Validate names after decoding quoted escapes: empty names, control characters, and line breaks are
errors, including when produced by escapes; leading/trailing whitespace inside quoted names is also
an error rather than silently trimmed. Tag equality uses case-sensitive comparison of decoded names
after [Unicode NFC normalization](https://www.unicode.org/reports/tr15/tr15-58.html); authored
source is preserved.

## D23. Schema retirement transition

This transition is proposed under [ADR-0005](../decisions/0005-pure-block-model.md); current Tag schemas remain supported until formal product acceptance and implementation.

Preserve user-authored schema files as ordinary files; do not automatically delete or convert them. Configuration still requesting the retired feature reports an unsupported-setting error with migration guidance rather than silently pretending the checks ran. This removal does not remove the grammar, identity, reference, or composition validation required by the proposed specifications.

[Roadmap D23](../../roadmap.md#d23-schemas-structural-validation-and-templates) owns removal tasks, partial-supersession timing and deferral of replacement schemas/structural validation/templates. This section relocates the existing transition contract without accepting or extending it.
