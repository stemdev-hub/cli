# Composition and publication

Status: accepted (23 October 2026), by explicit owner acceptance of revision `a56203e`.
Implementation remains pending. Governing decision:
[ADR-0005](../decisions/0005-pure-block-model.md). See
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

The [output manifest](#output-manifest) is separate operational state: recomputing current content
cannot recover which obsolete files Stem previously wrote. Clearing computation caches must not
erase generation ownership or enable cleanup without that evidence.

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

Regeneration uses newly supplied inputs for selected output targets, subject to their
[existing-file policy](#existing-file-policy) and [D25](#d25-export-eligibility-and-publication).
Stem keeps no saved output-content history and does not synchronize generated output back into
source. Adapters own writing, display and the [manifest](#output-manifest) of current generation
ownership; that bookkeeping stores no previous document contents.

### Output sets and targets

Project configuration may declare `outputSets`, a map of nonempty, case-sensitive set names to
explicit target lists and set-wide publication policies. An absent or empty map is valid for a
library-only project; an empty target list is also valid. A set is a named collection of mappings,
not a profile with inheritance, merging or implicit overrides. A target has exactly one `source`
selector and a nonempty relative destination `path`:

- `{ "kind": "block", "ref": "guide" }` selects a Block and its subtree. `ref` uses the ID or
  `alias:ID` target grammar from [inclusions](stem-syntax.md#d11-inclusion-syntax), without a directive
  wrapper. Resolve it from the configuring project's context under
  [D5](project-connections.md#d5-reference-context-and-project-aliases).
- `{ "kind": "file", "path": "blocks/guide.md" }` selects a whole local source file beneath
  `blocksDir`. Its path is project-relative, not relative to `blocksDir` or `outputDir`. File
  selection preserves surrounding text and definitions under [D11](#d11-inclusion); it creates no
  implicit Block. Connected content is available through Block references/inclusions, not arbitrary
  external file selectors.

Do not infer a selector kind from its spelling, derive filenames from IDs, or compose Tag matches
automatically. The same source may feed several explicitly named destinations. All source files
use the same parser and may contain definitions, inclusions and free text. Each target produces one
Markdown file; filenames are explicit, without automatic extension changes, heading adjustment,
formatting, asset copying or relative-link rewriting.

Each set has optional `outputDir` (default `"."`), `ifExists` (default `"replace"`), and `cleanup`
(default `"keep"`). Their contracts are below. Callers explicitly select sets, individual targets,
or all local sets; loading a connection never executes the connected project's output configuration.
Set names and destination paths identify configured targets; no new durable target ID is required.
Preview and stdout composition do not require an output set and never update destination ownership.

This configuration fragment illustrates the accepted contract with both selector kinds and an external destination; it is
not a complete project configuration or a claim of current CLI support:

```json
{
  "blocksDir": "blocks",
  "outputSets": {
    "repository": {
      "outputDir": ".",
      "ifExists": "replace",
      "cleanup": "keep",
      "targets": [
        { "source": { "kind": "block", "ref": "project-readme" }, "path": "README.md" },
        { "source": { "kind": "file", "path": "blocks/start.md" }, "path": "docs/start.md" }
      ]
    },
    "bundle": {
      "outputDir": "../published-docs",
      "ifExists": "replace",
      "cleanup": "prune",
      "targets": [{ "source": { "kind": "block", "ref": "project-readme" }, "path": "README.md" }]
    }
  }
}
```

### Source boundary and View retirement

Retain `blocksDir`, default `"blocks"`, as the single project-relative source directory within the
project. Files there need not define Blocks. Outputs may sit elsewhere, including at the project
root, but writing into the source directory is an error; do not silently exclude an output file
from the source model to permit this overlap.

Replace the legacy View role, its separate discovery/parser paths and `viewsDir` during the
corresponding migration. Preserve authored View files; do not delete, move or convert them
automatically. A remaining `viewsDir` setting reports an unsupported-setting error with guidance
to select the unified source directory and explicit output mappings. Files outside that directory
remain ordinary files until the author deliberately includes them in the new source layout.
The output manifest alone does not establish a Stem source project; source project identity and
configuration remain governed by [D5](project-connections.md#project-identity).

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

Prepare output in temporary storage, verify computation and writes, then publish according to the
existing-file policy, replacing the destination atomically where supported. Composition,
preparation or publication failure preserves any existing destination and explicitly reports that
it was not updated. Later tracking/cleanup failures follow [publication bookkeeping](#publication-bookkeeping-and-failures).

This is per-file, not batch atomicity; stdout can be prepared before emission but cannot retract
bytes on downstream failure.

### Destination paths and conflicts

Resolve a relative `outputDir` against the configuring project's root, never the process working
directory or the configuration file's directory. `.` selects the project root; `..` may select
external sibling or ancestor directories. Native fully qualified absolute directory paths are
also supported. Prefer relative paths in shared configuration. Reject empty, drive-relative,
host-incompatible or URL destinations rather than guessing a base or falling back to another path.
Output paths have this policy independently of [connection source paths](project-connections.md#local-path-resolution).

A target's `path` names a file beneath that output root: reject absolute paths, parent traversal,
empty filenames and directory destinations. Adapters resolve directory symlinks/junctions and
validate actual containment, including existing ancestors when creating new paths. Revalidate
before mutation; reject file symlinks and paths that escape the selected root. String-prefix checks
alone are insufficient. Apply the same protections to generation and cleanup.

Protect current and loaded connected source directories, project configuration, Git metadata,
Stem internal state and output manifests from target writes or deletion, including through aliases.
The adapter's own manifest update is separate from an authored output mapping. An output root is
only a path base; selecting it grants no permission to clear its contents.

Before any writes, reject conflicts among selected destinations: duplicate paths, case-only names,
aliases to the same physical destination, and file/directory-prefix collisions. Never pick a winner
by configuration order. Such a collision invalidates the entire selected publication plan: publish
no targets and perform no cleanup, including for otherwise independent targets. Different sets in
one project may target the same file in separate runs; selecting them together is a conflict.
A target with known ownership by a different producer project fails even with `ifExists: "replace"`;
do not silently take it over.

### Existing-file policy

The set-wide `ifExists` policy applies to each selected destination:

| Policy              | Destination absent          | Existing regular file                                                          |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| `replace` (default) | Publish an eligible result. | Replace with an eligible result, including when existing content was edited.   |
| `skip`              | Publish an eligible result. | Preserve and report a skip; no claim that its content is current or validated. |
| `error`             | Publish an eligible result. | Preserve and report a conflict.                                                |

Invalid policy values are configuration errors. Existing-file `skip`/`error` can be decided without
composing that target, but do not bypass destination/ownership checks. Enforce the policy at
publication as well as preflight: a newly appeared file must not be overwritten by `skip` or `error`.
If composition is needed, all [export-eligibility](#d25-export-eligibility-and-publication) checks
apply. Once the selected plan passes its collision checks, target-specific failures do not prevent
independent eligible targets from publishing. The overall operation reports failure when any target
fails. Intentional skips are not failures; manifest failures have the destination-root scope defined
under [publication bookkeeping](#publication-bookkeeping-and-failures).

### Output manifest

Maintain one manifest at `<outputDir>/.stem/outputs.json` per resolved output root, shared by the
producers writing there. Each record identifies the producer's durable project ID, output-set
association, root-relative destination path and SHA-256 hash of the last successfully generated
bytes. The manifest has an explicit format version. Store no machine-specific absolute root,
source ranges, document copies or content-version history. Its location binds paths to that root;
concrete record member names and decoding declarations belong to the publication implementation
slice, not a new public domain type.

An existing file merely skipped, even if its bytes match a possible result, is not newly adopted.
Preserve previous ownership records for skipped targets.
If another set in the same producer writes the same file in a separate run, update its last-write
association and hash; [cleanup](#obsolete-output-cleanup) checks all current sets before deletion.
Paths with known ownership by other producers remain protected.

Keep the manifest with persistent outputs: commit it with intentionally versioned outputs, or
preserve it with a reused output workspace. It is not a disposable cache or proof of current source
validity. Missing, corrupt and unsupported manifests have distinct behavior under
[publication bookkeeping](#publication-bookkeeping-and-failures).

Several projects may share a directory when their file ownership is disjoint. Serialize destination
publication, manifest updates and cleanup across cooperating writers for that resolved root;
preserve other producers' records. Project ID identifies the producer, not a checkout or lock:
different checkouts/revisions may share it. This contract does not promise distributed coordination
or safe concurrent writes through independently managed overlapping roots. Reject known collisions;
do not infer global ownership of files absent from the available records.

### Obsolete-output cleanup

An obsolete output is a recorded generated file whose destination is no longer requested. A still
targeted file containing older content needs regeneration, not cleanup. The set-wide `cleanup`
policy is `keep` (default) or `prune`; other values are configuration errors. `keep` reports known
obsolete files and preserves them. `prune` enables automatic selective deletion only after a
successful run covering the complete selected set and satisfying the rules below. A read-only
cleanup preview reports candidate deletions and conflicts using the same checks, without writing
files or state.

Before cleanup, validate the relevant configuration and resolve every current local set's target
paths to protect destinations still requested anywhere in that producer. Unresolved protection
information blocks cleanup rather than being treated as an empty set. Do not load or execute other
projects' output configurations to guess their intent; their known manifest ownership is protected.

A candidate must belong to the selected producer and set, no longer be targeted by any current
local set, remain a regular file within the authorized root, and have bytes matching its recorded
hash. Recheck path/type/hash before deletion. Line-ending conversions count as changes; do not
normalize them away. Never delete directories recursively or adopt untracked files through name,
extension, generated comments or matching content.

| Observed state                                   | Cleanup result                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Recorded obsolete file; bytes unchanged          | Eligible for deletion under `prune`; retained under `keep`.                   |
| Recorded obsolete file; bytes changed            | Preserve and report a cleanup conflict.                                       |
| Untracked file or another producer's file        | Preserve.                                                                     |
| Path still targeted by another current local set | Preserve, even if that set was not selected for generation.                   |
| Recorded obsolete path already absent            | Remove its obsolete tracking entry when applying cleanup.                     |
| Missing, corrupt or unsupported manifest         | No inferred ownership and no deletion based on that missing/invalid evidence. |

A single-target or otherwise partial-set run never prunes unselected targets. A complete set whose
targets all complete under `ifExists`, including intentional skips, may proceed to cleanup; skipped
destinations remain desired and receive no freshness claim. A valid empty target list can make its
previously recorded outputs obsolete; an unreadable/invalid configuration is never an empty list.

Removing a whole set or changing its output directory does not authorize automatic cleanup in the
former scope. Retain its old manifest records and require an explicit cleanup operation selecting
the old root, producer and retired set, still protecting all current destinations. Explicit cleanup
uses the same path, ownership, hash and valid-configuration checks without requiring regeneration
of a retired set. Renaming a set does not create a new producer or authorize deleting paths used
under the new name. Never reinterpret old relative records under a newly configured root or scan the filesystem for former
destinations. Explicit relinquishment may stop tracking a file while preserving it; it is not a
forced-deletion mechanism. CLI spellings remain an implementation-slice decision.

### Publication bookkeeping and failures

Validate each selected destination's manifest before publication or cleanup. A missing manifest
permits tracking new successful writes but establishes no ownership of pre-existing untracked files;
a fresh empty destination needs no prior records. A corrupt or unsupported manifest blocks all
publication and cleanup for that output root. Preserve it and report the error without replacing
it with an empty inventory. Independent roots with usable state may still publish; the overall
operation reports failure.

Prepare selected eligible outputs before pruning. Generation, publication or manifest-persistence
errors suppress automatic pruning for that run, including when independent targets succeed.
Record only confirmed successful writes, including during partial success; never report a failed
write as generated.
Preserve obsolete records until deletion is confirmed, absence is verified when applying cleanup,
or ownership is explicitly relinquished. Failure to delete a candidate retains its record and is
reported. Candidate eligibility and edited-file conflicts are owned by [cleanup](#obsolete-output-cleanup).

Persist manifest changes through safe atomic replacement where supported. A failure after a file
was published reports that actual outcome and the tracking failure; it does not claim the old file
was preserved or a batch rollback occurred. Do not proceed with automatic pruning using uncertain
tracking state. After a crash, unknown or hash-mismatched files stay preserved and may need explicit
reconciliation. No full output backup, transaction journal, reverse synchronization or recovery
service is required by this initial contract.

<a id="worked-examples-of-the-proposed-rules"></a>

## Worked examples of the accepted rules

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
accepted contracts; they do not claim current renderer behavior.

### Output publication examples

For the configuration fragment above, assume a valid `project-readme` Block and a source file
`blocks/start.md` containing `"Intro\n@stem:include(greeting)\n"`, where `greeting` resolves to a
valid Block with body `"Hello"`. With sufficient budgets, the file target writes
`"Intro\nHello\n"` to `docs/start.md`; that source file needs no Block of its own. The Block target
uses only the selected subtree, independently of its containing source filename. These are accepted
acceptance cases, not examples executable against today's CLI:

| Scenario                                                                      | Expected behavior                                                                                                                                           |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repository` and `bundle` both select `project-readme`                        | Publish independent results at each explicitly mapped `README.md`; track each destination locally.                                                          |
| Two selected targets collide and a third has an independent destination       | Reject the entire selected plan before writes or cleanup; the third target is not published either.                                                         |
| `repository` has a corrupt or unsupported manifest; `bundle` has usable state | Preserve `repository` files/state and block publication and cleanup there; `bundle` may publish. Report failure and suppress automatic pruning for the run. |
| A target maps into `blocks/`, `.git/`, or the output manifest                 | Reject the protected destination, even with `replace`.                                                                                                      |
| A target uses `../README.md` beneath its output root                          | Reject traversal; an external directory must be selected through `outputDir`.                                                                               |
| An existing destination uses `skip`                                           | Preserve it without claiming current content or adopting new ownership; a missing destination is generated normally.                                        |
| Remove `docs/start.md` from `repository`, retaining the set                   | `keep` reports and preserves its recorded file; `prune` deletes it only after a successful complete-set run and an unchanged-byte check.                    |
| Edit that obsolete file, or remove its manifest                               | Preserve it: an edit is a cleanup conflict; missing records cannot establish ownership.                                                                     |
| Another current set still targets `docs/start.md`                             | Preserve it during cleanup regardless of whether that set was selected for generation.                                                                      |
| One selected output has an unresolved inclusion while another succeeds        | Publish the independent eligible output and record it; report failure and suppress automatic pruning for the run.                                           |
| Move `bundle` to a different `outputDir`, or remove the set                   | Preserve the previous destination and its records until explicitly selected for retired-scope cleanup.                                                      |
