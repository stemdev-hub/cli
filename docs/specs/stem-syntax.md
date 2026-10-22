# Stem source syntax

Status: proposed. Working agreements, not accepted or implemented behavior. Governing decision:
[ADR-0005](../decisions/0005-pure-block-model.md) (proposed). See
[architecture](../architecture.md#proposed-pure-block-design) for document ownership and D-label
navigation.

Stem source describes reusable content and how to assemble it; its authoring instructions follow
Stem grammar ([D26](#d26-representation-grammar)), while the output language governs the resulting
content's interpretation.

## Parser contract

The proposed public entry is `parse(SourceDocument): ParseResult`, directly replacing
`parseBlockFile()` and `parseViewFile()` under ADR-0005. Do not retain parser aliases for the
legacy file roles. Parsing interprets one supplied document without project resolution or I/O.

`SourceDocument` has readonly string fields `sourceId` and `content`. The adapter supplies a source
handle that identifies the document within the evaluation context; it is neither a durable Block ID
nor a [connection source binding](project-connections.md#connection-record-and-source-binding).
Core does not interpret it as a filesystem path. `SourceRange` has readonly numeric `startOffset`
and `endOffset`: zero-based UTF-16 code-unit offsets, with an exclusive end, into the original,
unnormalized `content`. Adapters derive display locations; positions never enter persisted caches.

`ParseResult` contains readonly `tree: SyntaxTree` and `diagnostics: readonly Diagnostic[]`.
Malformed authored syntax returns a recovered tree together with
[diagnostics](composition.md#diagnostic-contract), rather than discarding the tree on the first
error. A tree's existence does not establish validity or export eligibility.

### Syntax tree representation

`SyntaxTree` retains the supplied document in `source` and its ordered root `children`. This
technical document root includes surrounding text and multiple root definitions; it is not an
implicit domain Block. Retain original content once, with ranges into it, rather than copying a
complete body for every ancestor. Node records and child arrays are readonly; the
[evaluation ownership contract](composition.md#d20-evaluation-inputs) governs their lifetime.

Each node carries `kind` and `range`. The node categories carry the following additional data:

| `kind`    | Required data and interpretation                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `text`    | `value`: literal text to emit after interpreting Stem escapes; the range retains access to its original spelling.                 |
| `block`   | `header`, ordered `children`, and `ending`; retain metadata occurrences and their ranges, including repeated or malformed fields. |
| `include` | `target`: the syntactically parsed reference, retaining its optional qualifier and ID without resolving a project or definition.  |
| `error`   | `value`: the literal failed fragment required by recovery, without guessed instructions or targets.                               |

A Block header retains its full original range and whether it has a recognized terminating
parenthesis, so an unfinished header can preserve its visible error fragment under
[recovery](#invalid-headers-and-ownership-recovery).
Do not collapse repeated metadata into a last-value-wins dictionary. Header information and error
fragments describe the same original source where needed; they do not cause duplicate emission.

`ending` distinguishes `marker` (an actual closing-marker range), `ancestor` (an implicit end at
the ancestor's closing-marker start), and `eof` (an implicit end at the original content's end).
Only `marker` supplies an actual closer for [boundary whitespace](#boundary-whitespace). Recovery
does not synthesize source characters or a closing-marker range. A Block's range ends after its
actual closer, or at its implicit ending when no closer belongs to it.

Text values record literal intent during parsing and are emitted during composition. Stem escapes
are interpreted once from original source; composition never applies them again to those values or
rescans assembled output. This does not decode Markdown/HTML escapes or normalize source text.
Boundary-newline removal is a separate operation governed by actual boundaries, not general trimming
of text values. Error fragments retain their literal recovery spelling.

Use a small portable TypeScript scanner with an explicit nesting stack. The syntax tree carries no
resolved project targets or semantic lookup indexes; [project analysis](block-model.md#project-analysis)
owns that interpretation. Syntax records are technical representations, not new domain primitives.
Whole-document parsing is the initial approach; incremental parsing and additional parser tooling
require demonstrated need. Only helpers required by actual consumers become public exports.

## D11. Inclusion syntax

The initial representation uses one explicitly bounded inclusion expression,
`@stem:include(<target>)`, with the same form inline and on its own line, both inside Blocks and in
surrounding Markdown. No surrounding whitespace or word boundary is required; a recognized
expression may directly adjoin text, punctuation, or another expression without adding separators.

The command is `include`, with one unquoted positional target: a local ID or `<project>:<ID>`. The
colon separates the optional project qualifier from the ID and cannot occur inside the qualifier.
Project qualifiers contain nonempty groups of lowercase ASCII letters and digits separated by single
hyphens; uppercase and underscores are errors, without automatic case conversion. Targets have no
`#` prefix or named-field aliases. Whitespace inside the target, including around the qualifying
colon, is an error.

Missing or malformed targets and extra arguments within the expression are errors, with usable
surrounding content preserved under [D13](composition.md#d13-localized-recovery) and affected
exports governed by [D25](composition.md#d25-export-eligibility-and-publication). Expression
whitespace follows [D26](#d26-representation-grammar). Malformed inclusions use
[D26](#d26-representation-grammar)'s shared failed-fragment recovery. The affected result is
incomplete and normal export remains blocked under
[D25](composition.md#d25-export-eligibility-and-publication).

Substitution behavior is specified in [D11 composition](composition.md#d11-inclusion).

## D26. Representation grammar

### Recognition and source lines

Recognize Block openers, closers, and inclusions uniformly throughout source using Stem grammar,
independently of the surrounding output-language syntax; explicit Stem literal escaping suppresses
recognition locally. This includes prose, headings, lists, quotes, code spans, fenced and indented
code, all HTML regions, links and images and their components. Defining reusable fragments inside
such content uses ordinary Blocks and the same ownership rules. Stem recognition does not require
parsing each surrounding language. Blank lines around dedicated boundaries are optional; Markdown
prefixes and indentation remain authored content and do not establish ownership, and prefixes
outside a definition remain outside its content.

For all three commands, the exact `@stem:` prefix, command name, and opening parenthesis are
contiguous. Optional ASCII spaces/tabs may occur immediately inside either parenthesis, including in
an argument-free closer; they are instruction syntax, not content. Each complete expression occupies
one source line; line breaks within an expression are errors, while Block content may span lines.
This does not permit whitespace within IDs or inclusion targets, around a qualifying colon, or
between a metadata field name and its colon. Spaces/tabs and line endings outside expressions follow
the content and boundary rules below.

Source line endings are LF (`\n`), CRLF (`\r\n`), and CR (`\r`), each treated as one whole unit for
boundary syntax and line-bounded expressions/recovery; never consume only part of a CRLF pair.
Preserve every surviving line-ending sequence exactly as authored, including mixed sequences,
without normalization. Other Unicode separator characters do not delimit source lines;
[D29](block-model.md#d29-tag-names-and-equality)'s Tag-name restrictions still apply.

### File-level frontmatter

Stem does not parse file-level frontmatter as metadata or derive Block identity, Tags, or other
Stem settings from it. Its delimiters and contents are ordinary authored text: whole-file
composition preserves them, while separately selecting a Block excludes them unless authored
inside that Block. Uniform instruction recognition and escaping still apply there; frontmatter
does not protect marker-shaped text from Stem grammar. Downstream tools may interpret the output.

This proposed replacement requires the explicit retirement of
[ADR-0002](../decisions/0002-frontmatter-yaml-core-schema.md)'s frontmatter policy under
[ADR-0005](../decisions/0005-pure-block-model.md); it does not describe current parsing behavior.

### Definition boundaries

Block ownership uses explicit paired opening and closing boundaries. The initial representation
supports inline as well as multiline definitions of the same Block, including roots, children, and
siblings; nesting determines ownership, independently of line placement. Headings and ordinary body
indentation do not determine ownership. Opening markers use `@stem:block(...)`, with mandatory
`id:<ID>` in the parenthesized metadata; closing markers use `@stem:end()` or `@stem:end(id:<ID>)`.
These are the single boundary spellings for both inline and multiline definitions.

### Header metadata

Opening metadata accepts only `id:` and `tags:` fields, in either order, separated by one or more
spaces or tabs. Field names stay adjacent to their colon, spaces or tabs may follow that colon
before the value, and trailing spaces or tabs within metadata are ignored. Metadata values are
literal data, not evaluated Stem instructions; marker-shaped text in a valid value does not define,
close, or include Blocks. The opening instruction ends at its closing parenthesis outside the Tag
list and quoted strings; parentheses within valid Tag names are data. Unknown fields and repeated
`id:` fields are definition errors; no ID is chosen from repeated fields. Continue parsing the body
and children ([D13](composition.md#d13-localized-recovery)).

### Boundary whitespace

For inline, multiline, and mixed layouts, each actual boundary belonging to a Block is evaluated
independently in the original source: at most one line ending directly after its complete opening
marker and at most one directly before its actual closing marker belong to boundary syntax, not
Block content, regardless of surrounding text or the opposite edge's layout. An implicit recovery
ending is not a closing marker and removes no newline.

Spaces and tabs inside the boundaries are content just like letters; an intervening space or tab
prevents newline removal at that edge. Do not search past content or trim the resulting content.

A shared boundary line ending in an empty definition is consumed only once; empty, adjacent, and
nested definitions follow the same rule. All other authored spaces, tabs, and line endings remain
content. A line ending after the closing marker is outside that Block and remains in its surrounding
source.

### Escaping and original-source evaluation

In content immediately before the exact `@stem:` prefix, each pair of consecutive backslashes emits
one literal backslash; an additional unpaired backslash is consumed and suppresses recognition of
that marker, emitting it literally. An even-length run leaves the marker active; an odd-length run
makes it literal. Elsewhere backslashes remain ordinary content; quoted Tag metadata retains
[D27](#d27-tag-list-syntax)'s JSON escaping.

Escaping one marker does not protect later markers, a matching closer, or the rest of the line; a
literal definition example must escape its opener and closer independently. `/` is not a Stem
escape; escaping does not repair invalid expression syntax. Stem consumes its own escapes during
composition, uniformly in every surrounding language context, without rewriting authored source.

Instructions are recognized in their original source; composition recursively evaluates those
recognized instructions without rescanning assembled output for new instructions or escapes. Literal
content retains that intent through nested inclusion, and joining content fragments that spell a
Stem expression does not create an instruction.

### Shared failed-fragment recovery

The exact unescaped `@stem:` prefix is reserved everywhere instructions can occur, including inline;
metadata values retain their literal-data rules. Unknown commands report localized errors regardless
of line placement. Ownership begins only after recognizing the exact `@stem:block(` opener; a
missing opening parenthesis, whitespace before it, or a misspelled command does not open a Block or
trigger guessed ownership.

For malformed inclusions, unknown commands, commands missing their required adjacent opening
parenthesis, and syntactically malformed closers, recovery stops at the first closing parenthesis,
next unescaped `@stem:` prefix, or line end/EOF, whichever comes first. Include a terminating
closing parenthesis in the failed fragment; leave the next marker and line ending for normal
processing. Preserve the failed fragment literally in partial output without reinterpreting it or
guessing a target, report a localized error, and continue processing independent content. These
failed fragments perform no ownership or inclusion action; relevant errors block normal export under
[D25](composition.md#d25-export-eligibility-and-publication). No command spelling or missing
delimiter is automatically corrected.

### Invalid headers and ownership recovery

When the header has a recognized terminating `)` but its metadata is invalid, report the definition
errors and continue parsing content and children immediately after that parenthesis. An invalid
metadata value does not by itself turn a correctly terminated header into an unfinished header.

For a recognized `@stem:block(` opener whose header is unfinished at line end/EOF, retain the
intended Block as invalid for ownership recovery. Bound the unfinished header by that source line,
consistent with [D28](#d28-tag-diagnostics-and-recovery), and recover its body from the following
line if present; subsequent closers apply to that recovered nesting. Preserve the broken header as a
visible error fragment in partial output. Retain only unambiguously parsed metadata, without
inventing an ID or selecting among repeated IDs. Do not guess a same-line division between
unfinished metadata and body content; preserve that fragment intact. Recovery does not validate the
definition, and [D25](composition.md#d25-export-eligibility-and-publication) blocks affected normal
exports.

Closing IDs are optional; definition IDs remain mandatory
([D4](block-model.md#d4-durable-identity)). An unlabelled closer closes the innermost open Block; a
supplied ID must match that Block. A syntactically malformed closer reports an error and closes
nothing; an incomplete `id:` is not treated as an unlabelled closer. The current Block remains open
until a usable closer or end-of-file recovery.

For recovery only, a mismatched ID identifying an unambiguous open ancestor ends intervening
unclosed Blocks at that boundary with missing-closer errors, then closes the ancestor; this does not
make the source valid or infer earlier content divisions. That marker is an actual closer only for
the ancestor; the intervening Blocks end implicitly under the boundary-whitespace rule.

A closer with no open Block, or an ID matching neither the innermost Block nor an unambiguous open
ancestor, reports an error and closes nothing; preserve that unmatched closer literally in partial
output. This does not change ancestor recovery, where the closer closes the identified open
ancestor.

At end of file, recover still-open Blocks through EOF with missing-closer errors, preserving their
remaining content, including trailing spaces, tabs and line endings. There is no closing-boundary
newline removal at EOF. Apply [D25](composition.md#d25-export-eligibility-and-publication) to
affected exports. Recovery does not insert source text or infer boundaries from headings, blank
lines, or later opening markers; later openings remain nested while a parent is open.

### ID spelling and comparison

IDs are unquoted, nonempty strings containing only ASCII letters (`A–Z`, `a–z`), digits (`0–9`),
hyphens (`-`), and underscores (`_`), with no special first-character requirement. Definition IDs,
labelled closer IDs, and inclusion target IDs use exact, full-string, case-sensitive comparison
without numeric conversion, automatic lowercasing, or abbreviated matching.

## D27. Tag list syntax

Direct Tags use an explicit `tags:[...]` list on the Block's opening line for both one and multiple
Tags: `tags:[guide]` and `tags:[guide, api]`. Omitting the field or writing `tags:[]` means no Tags;
a present field requires brackets. Commas separate entries; empty entries and trailing commas are
errors.

Names may be unquoted, including spaces, or double-quoted using
[JSON string-escape rules](https://www.rfc-editor.org/rfc/rfc8259.html#section-7). Each entry is
wholly unquoted or one double-quoted string; mixing quoted and unquoted fragments is an error.
Commas separate entries and a closing square bracket ends the list only outside quoted strings;
those characters within a quoted string are data. A JSON-escaped double quote does not end that
string. These delimiters follow Stem metadata grammar independently of the surrounding output
language.

Unquoted entries have no escape syntax and cannot contain square brackets, double quotes, or
backslashes; names containing those characters or literal commas require whole-entry quoting.
Surrounding spaces/tabs in unquoted entries are ignored.

Name validation is specified in [D29](block-model.md#d29-tag-names-and-equality); header termination
and recovery follow [D26](#d26-representation-grammar) and [D28](#d28-tag-diagnostics-and-recovery).

## D28. Tag diagnostics and recovery

Duplicate Tag names attach once with a warning; repeated `tags:` fields are definition errors, with
no silent merge or choice of one field. Preserve authored source. Malformed-list recovery retains
only unambiguously parsed Tags and reports incomplete classification. Recovery is bounded by the
header's recognized termination, or by the opening line if the header is unfinished, so an
unfinished quote cannot consume subsequent Markdown. Continue parsing the Block's body and children
under [header recovery](#invalid-headers-and-ownership-recovery). A Tag error does not by itself
invalidate a unique valid ID or independently bounded children; selection and diagnostic scope follow
[D10](block-model.md#d10-id-and-tag-selection). Relevant definition errors block normal export under
[D25](composition.md#d25-export-eligibility-and-publication) while previews preserve usable content.

Single-Tag shorthand is tracked in the
[deferred design work](../../roadmap.md#pure-block-open-and-deferred-work).

## Worked examples of the proposed rules

These illustrate existing rules above; they are not examples for the current parser. The table uses JSON string notation so line endings and spaces are visible.

| Original source                         | Block `a` content under boundary-whitespace rules |
| --------------------------------------- | ------------------------------------------------- |
| `"@stem:block(id:a)\nA\n@stem:end()"`   | `"A"`                                             |
| `"@stem:block(id:a) \nA\n @stem:end()"` | `" \nA\n "`                                       |
| `"@stem:block(id:a)\n@stem:end()"`      | `""`                                              |

Each edge is independent; a space prevents consuming a newline at that edge. The shared newline in the empty definition is consumed once.

Recovery examples use the same JSON string notation. The recovered content does not make the
definition valid; the listed errors still block affected normal exports.

| Original source                                         | Recovery outcome                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"@stem:block(id:a tags:[guide,])A@stem:end()"`         | The terminated header has a Tag error; `a` remains addressable, `guide` is retained, and body content is `"A"`.                                                                                                                                                                                           |
| `"@stem:block(id:a tags:[guide\nA\n@stem:end()"`        | The unfinished header remains a literal error fragment through its source line; body recovery starts with `A` on the next line. Whole-file partial output is `"@stem:block(id:a tags:[guide\nA"`: the unfinished opener removes no newline, and the actual closer removes the newline directly before it. |
| `"@stem:block(id:a)\nA\n\t"`                            | EOF reports the missing closer; `a`'s recovered body is `"A\n\t"`, preserving trailing whitespace.                                                                                                                                                                                                        |
| `"@stem:block(id:a)@stem:block(id:b)B @stem:end(id:a)"` | The labelled closer closes `a`; `b` ends implicitly with a missing-closer error. Its recovered body is `"B "`; recovery neither invents an earlier ending nor trims content.                                                                                                                              |

For literal escaping, assume Block `a` contains `X`. One source backslash immediately before `@stem:include(a)` suppresses recognition and emits the literal expression; two source backslashes emit one backslash followed by the evaluated `X`. Escaping a definition opener alone does not protect its closer. These results follow [original-source evaluation](#escaping-and-original-source-evaluation), not rescanning of the assembled output.
