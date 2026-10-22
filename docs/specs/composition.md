# Composition and publication

Status: proposed. Working agreements, not accepted or implemented behavior. Governing decision:
[ADR-0005](../decisions/0005-pure-block-model.md) (proposed). See
[architecture](../architecture.md#proposed-pure-block-design) for document ownership and D-label
navigation.

## D11. Inclusion

Block inclusions recursively expand the target subtree at the inclusion's position, preserving
authored order. Composition processes explicit authoring instructions without modifying source
Blocks or containment, preserving authored content and intentionally literal syntax according to the
representation rules. It does not automatically repair or beautify the resulting document. Markdown
is the current output format; downstream rendering determines presentation.

Composition replaces only the recognized inclusion expression with the target's recursively composed
content, preserving all surrounding text and whitespace, including newlines, regardless of line
placement; there is no automatic trimming, spacing, reindentation, or flattening.
[D26](stem-syntax.md#d26-representation-grammar)'s uniform recognition and explicit literal-escape
rules apply equally to inclusions.

Substitution does not automatically encode URLs, escape HTML or quotes, coerce content, or add
output-language validation. Authors supply content suitable for its insertion context; this does not
change [D25](#d25-export-eligibility-and-publication)'s existing error/export behavior.

Whole-file composition emits each definition's body in its authored position, recursively emitting
contained definitions and removing their boundary syntax under the
[boundary-whitespace rules](stem-syntax.md#boundary-whitespace). Surrounding content remains in
place, including [file-level frontmatter](stem-syntax.md#file-level-frontmatter). An inclusion emits
another occurrence of its target even if that definition's body already appears elsewhere in the
output. Selecting a Block alone excludes surrounding file content under
[D22](block-model.md#d22-surrounding-content).

For a syntactically valid inclusion whose target is missing, ambiguous, or otherwise unresolved,
emit no text for that occurrence and report a localized error with an incomplete result. Preserve
the surrounding text exactly; add no placeholder or separator. A resolved target with definition
errors still supplies usable preview content and relevant diagnostics under
[D10](block-model.md#d10-id-and-tag-selection). Malformed syntax instead retains its literal failed
fragment under [syntax recovery](stem-syntax.md#shared-failed-fragment-recovery); an unfinished
definition header retains its specified visible error fragment. These are recovery representations,
not normal-export success under [D25](#d25-export-eligibility-and-publication).

The same substitution behavior applies inline and on a dedicated line; see
[inclusion syntax](stem-syntax.md#d11-inclusion-syntax) for recognition and malformed-expression
handling.

## D12. Expansion cycles

Re-entering the same Block in the same resolved project instance
([D5](project-connections.md#d5-reference-context-and-project-aliases)) on the current expansion
path through containment or inclusion is a cycle error; stop only the re-entering occurrence,
whether reached through containment or inclusion, preserving usable surrounding content with a
localized diagnostic and an incomplete result. The stopped occurrence emits no text; independent
content continues unless the result's [D24](#d24-resource-budgets) budget is exhausted. Repeated use
on separate paths is valid; reaching the same durable Block ID in a different selected revision is
not by itself a cycle.

Resolution supplies a finite instance graph under
[D5](project-connections.md#resolved-instance-graph); aliases must not conceal a revisit. Instance
distinctions account for selected source state and dependency bindings, independently of optional
storage or computation sharing. A connection-graph cycle alone is not an expansion cycle unless
Block expansion re-enters an active Block instance.

## D13. Localized recovery

Throughout processing, confine recoverable errors to the smallest affected region, including regions
within Blocks. Preserve usable surrounding content and independent results, returning partial
results with localized diagnostics rather than replacing the whole Block or operation with an error.
When an output's evaluation budget is exhausted, [D24](#d24-resource-budgets) defines its stopping
point; independent requested outputs retain their own budgets.

### Diagnostic contract

`Diagnostic` carries a stable `code`, explicit `severity`, readable `message`, a primary location
when available, and related locations when useful. A source location identifies `sourceId` and a
[SourceRange](stem-syntax.md#parser-contract); retain instance context where needed to distinguish
interpretations of shared source. Related locations explain duplicate candidates, reference targets,
or recovery context. Configuration or availability errors need not invent a source range.

Maintain internal associations between diagnostics and the definitions, syntax regions or evaluation
operations they affect. Display location alone does not determine semantic ownership; do not infer
scope solely from overlapping ranges. A malformed ancestor header does not automatically invalidate
an independently selected child under [D10](block-model.md#d10-id-and-tag-selection).

Project analysis exposes project-wide diagnostics. Selection and composition return diagnostics
applicable to their requested results; adapters do not reject an otherwise eligible output solely
because project-wide analysis contains unrelated errors. Diagnostic records and collections are
readonly. Counts and validity summaries are derived, not independent writable state.

## D14. Completeness and validity

Content completeness and validation validity are distinct: a missing inclusion target makes
composition partial and produces a validation error. A definition error such as an invalid Tag list
can leave all body text available while blocking normal export. Incomplete Tag classification is
reported separately under [D10](block-model.md#d10-id-and-tag-selection).

`compose()` returns `CompositionResult` with readonly `content: string`, `complete: boolean`, and
`diagnostics: readonly Diagnostic[]`. `complete` states whether all requested content was produced;
it is not a validity or success flag. A definition error can therefore accompany complete body
content, whereas a failed inclusion leaves incomplete content. Both remain available to preview.
Derive normal-export eligibility from completeness and applicable blocking diagnostics under
[D25](#d25-export-eligibility-and-publication); do not maintain an independent writable `exportable`
flag. The parser's and selector's result contracts remain owned by their respective specifications.

## D16. Affected results

Block-content changes refresh affected Block results and their dependent ancestor/inclusion results;
file co-location alone creates no semantic dependency. Whole-file rereading/reparsing is allowed
without treating every contained Block as semantically changed (see
[Salsa's parsing/reuse distinction](https://salsa-rs.github.io/salsa/tutorial/parser.html)).

## D17. Result dependencies and propagation

Track all inputs that affect each result, including resolution state, relevant configuration, and
supplied external source content. Stop downstream propagation when the result consumed there is
unchanged, accounting for relevant content, diagnostics, and completeness; refresh source locations
separately without persisting parse-time positions.

## D18. Disposable computation caches

Computation caches are disposable derived data: identical supplied source content and configuration
must yield identical content, diagnostics, and completeness with or without a cache. Missing,
corrupt, or incompatible caches trigger recomputation; external source content is an input whose
availability is separately required.

## D19. Current results

Current composition never silently substitutes a previous successful result or stale content for a
current error; preserve usable current content with localized diagnostics.

## D20. Evaluation inputs

Each evaluation uses the source content and configuration supplied by its adapter, unchanged during
that evaluation; changes enter subsequent evaluations. No project-wide atomic snapshot, saved
snapshot history, or new domain primitive is required. Editor adapters prevent older completed
evaluations from replacing newer results.

Public input/result records and their arrays are readonly; core does not mutate supplied inputs or
previously returned trees and results. TypeScript `readonly` expresses this contract but does not
freeze objects at runtime, so implementations must also prevent mutation through retained aliases.
This does not require a new immutability library or a prescribed runtime-freezing strategy.

Adapters own cancellation and rejection of obsolete evaluations, accounting for changes to any
relevant supplied source or configuration rather than only the active editor document. Core keeps
its portable supplied-input boundary. Whole-document parsing may coexist with downstream reuse
under D16-D18; incremental parsing, packed tree storage, workers and persistent analysis sessions
are not prerequisites and require measured need.

## D21. Regeneration

Successful regeneration uses newly supplied inputs and replaces the selected generated output, or
writes to another explicitly selected destination, subject to
[D25](#d25-export-eligibility-and-publication). Stem maintains no output history and does not
synchronize generated output back into source; adapters own writing and display.

## D24. Resource budgets

Each requested output has a finite, configurable work budget and output budget, shared by all its
nested expansions. Independent requested outputs have separate allowances. Cycle detection remains
required: cycle-free repetition can still multiply output exponentially, and empty expansions can
consume substantial work without producing text.

Charge one work unit for each attempted Block entry and one for each inclusion attempt, including
the selected root Block, contained Blocks, repeated occurrences, failed inclusions and cycle
re-entry attempts. An inclusion attempt is charged before resolution; entering its resolved target
is a separate Block-entry charge before processing that Block. A missing target has no target-entry
charge. A whole-file request does not invent an implicit root Block. These counters measure logical
expansion work, not elapsed time or parser implementation steps.

Count the UTF-8 bytes emitted into that requested output, including all surviving whitespace and
repeated content. Count final emitted bytes once, not again for each enclosing Block. Never split
a Unicode code point to fit the remaining allowance.

Traverse in authored order, expanding each containment or inclusion occurrence before continuing
with following content. Before an action exceeds either remaining allowance, stop that output and
retain the produced prefix. If the next text exceeds the output allowance, retain the longest
prefix that fits without splitting a code point, then stop; do not skip ahead to later content or
insert a placeholder. Report the exhausted limit and affected location, mark the result incomplete,
and block normal export under [D25](#d25-export-eligibility-and-publication). Already produced
diagnostics remain available. Exhaustion does not itself invalidate Block definitions. Reaching a
limit exactly is permitted when all work and output finish within both allowances.

Cached evaluation must have identical logical charges, partial content, diagnostics and completeness
to uncached evaluation under [D18](#d18-disposable-computation-caches). Reusing a cached result cannot
discount its nested occurrences or discard a whole cached fragment where uncached evaluation would
retain a prefix. Cache representation and traversal techniques remain implementation choices.

Check allowances before expansion or oversized allocation and use stack-safe traversal so deep
nesting cannot overflow the call stack before a work limit is reached. These two counters bound
composition work and output, not total process memory or execution time. Parsing and source
retrieval are separate concerns. Callers may raise limits for intentionally large outputs; optional
preview folding or additional bounded evaluation belongs to presentation. Numeric defaults await
measurement during composition implementation, as tracked in
[open work](../../roadmap.md#pure-block-open-and-deferred-work).

## D25. Export eligibility and publication

Previews may expose partial results; normal file exports publish only complete results without
artifact-blocking errors. Definition errors in Blocks represented by an output, and resolution or
composition errors affecting that output, block normal export; unrelated project errors do not.
For selected subtrees, the scope of inherited definition diagnostics follows
[D10](block-model.md#d10-id-and-tag-selection): errors in included descendants affect the parent
result, while independent child selection does not automatically inherit unrelated parent errors.

Prepare output in temporary storage, verify computation and writes, then safely replace the
destination atomically where supported; failure preserves any existing destination and explicitly
reports it was not updated.

This is per-file, not batch atomicity; stdout can be prepared before emission but cannot retract
bytes on downstream failure.

## Worked examples of the proposed rules

The following table uses JSON string notation to make whitespace explicit. Budgets are sufficient
unless a row specifies otherwise.

| Source or supplied input                                                                 | Result                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole file: `"@stem:block(id:greeting)Hello@stem:end()\nAgain: @stem:include(greeting)"` | Complete output: `"Hello\nAgain: Hello"`. The inclusion emits another occurrence, not another definition.                                                                                                |
| Whole file: `"L@stem:block(id:a)\nX\n@stem:end()R"`                                      | Complete output: `"LXR"`; no separator is added. Selecting `a` alone gives `"X"`.                                                                                                                        |
| Whole file: `"---\nid: old\n---\n@stem:block(id:a)A@stem:end()"`                         | Complete output: `"---\nid: old\n---\nA"`. Only `a` is a Block ID; the frontmatter text creates no definition.                                                                                           |
| `"Before @stem:include(missing) after"`, with no target `missing`                        | Partial output: `"Before  after"`, with a localized resolution error; normal export is blocked. An ambiguous target has the same omission behavior.                                                      |
| `"Before @stem:include(bad id) after"`                                                   | Partial output retains the malformed expression literally, with a syntax error; normal export is blocked.                                                                                                |
| Selected `a` has body `"L@stem:include(a)R"`                                             | Partial output: `"LR"`, with a cycle error for the re-entering occurrence.                                                                                                                               |
| Text `"Hi 🌱!"`, with a five-byte output allowance                                       | Partial output: `"Hi "`, with an output-budget diagnostic. The four-byte emoji cannot fit in the remaining two bytes. With eight bytes and sufficient work allowance, the entire text fits and succeeds. |
| Selected `a` includes empty Block `b` twice                                              | Completion needs five work units: entry to `a`, then two inclusion attempts and two entries to `b`. A cache does not reduce this charge.                                                                 |

A cycle through several Blocks or aliases follows the same active-instance rule. Repeated use on
separate completed paths is valid and charged for each occurrence. These examples illustrate the
proposed contracts; they do not claim current renderer behavior.
