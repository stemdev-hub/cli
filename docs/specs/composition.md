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

Core owns the shared Block-instance identity and active-path cycle checks used by graph checking
and composition; CLI, MCP and editor adapters consume its results without duplicating those checks.
Each operation retains its own traversal and diagnostic scope. Composition checks entry into its
current expansion path rather than rescanning the entire graph for every occurrence; completed
visits on other paths are not active entries. A graph-wide check does not replace this expansion
guard or the work/output budgets in D24.

Use an explicit traversal stack and the shared internal active-path helper. Active entries identify
the recovered definition together with its resolved instance, not just its authored ID. Process
each occurrence in authored order; completed occurrences leave the active path and may be expanded
again with their own logical charges under D24.

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

### Composition invocation

The public operation is `compose(analysis, target, limits)`. It consumes a supplied
`ProjectAnalysis`; it performs no source discovery, file reads, connection retrieval or publication.
The target explicitly distinguishes a Block reference resolved from a supplied instance from a
source document selected by `sourceId` within a supplied instance. Never infer the selector kind
from a string's spelling. Instance and source handles belong to that analysis under
[D20](#d20-evaluation-inputs) and the [supplied-context contract](project-connections.md#supplied-evaluation-context).
Configured output selectors retain the adapter-facing path and local-file restrictions below.

The operation uses the shared core reference resolver and returns the result described in D14.
One implementation replaces `renderViewMarkdown()` and both legacy rendering branches directly;
retain no old renderer alias, View-shaped adapter or alternate parser/rendering fallback.
Limits follow [D24](#d24-resource-budgets); declaration details belong in implementation types/TSDoc.

### Preview and output adapters

Preview exposes current partial content and applicable diagnostics separately. CLI, MCP and editor
adapters must not inject error messages into composed Markdown, reconstruct frontmatter, trim
content or append a newline. Normal export, including stdout, checks D25 eligibility before
publishing content; preview does not require export eligibility. Neither mode rejects a selected
result solely because analysis reports unrelated project errors.

`previewSource(selector, options)` replaces `previewView()` and returns
`OperationResult<CompositionResult>`. Use the explicit Block/file selector shapes and local-file
boundary in [output selectors](#output-sets-and-targets), without requiring an output set. The Node
adapter discovers/loads inputs and resolves the selector into the supplied analysis. A completed
evaluation returns `{ success: true, data }`, even when `data` is incomplete or has blocking
diagnostics; this means preview was evaluated, not that export is permitted. Invalid adapter input
or configuration and loading failures return `{ success: false, error }`. Resolution/composition
diagnostics from an available analysis remain in the composition result, not discarded as operation
errors. Keep the result and nested records readonly; concrete declarations belong in types/TSDoc.

Preview and stdout evaluation do not write configuration, computation caches, outputs, manifests or
locks. They consume available source inputs; unavailable connected content is not replaced by metadata
snapshots. Resource allowances follow D24, including measurement before selecting shared defaults.

#### Terminal preview and stdout export

| Command | Content and status |
| ------- | ------------------ |
| `stem preview block <ref>` / `stem preview file <path>` | Emit exact current content to stdout, including partial content. Emit diagnostics separately to stderr; exit nonzero for incomplete results, blocking diagnostics or operation failures. |
| `stem render block <ref> --stdout` / `stem render file <path> --stdout` | Prepare and check export eligibility before emitting any content. Ineligible results emit no Markdown; report diagnostics to stderr and exit nonzero. |

Warnings alone do not fail an otherwise complete result. Operation failures emit no composed content.
The source-render commands require `--stdout`; file destinations use configured output-set commands.
Reuse source evaluation and D25 eligibility checks without another renderer or public export API.
Neither stdout mode adds a heading, status summary or trailing newline to the composed content.
These commands are replacement contracts awaiting implementation, not current usage instructions.

#### MCP preview

Replace the composed-View resource `stem://views/{id}` with the read-only `preview_source` tool;
retain no compatibility resource alias. Its input contains the same explicit `selector`, and its
output schema describes the preview operation's success/error envelope. Return that envelope in
`structuredContent` and serialize the same envelope into a text content block, following the
[MCP structured-result contract](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content).
Composed Markdown remains in `data.content`, separate from `data.diagnostics` and `data.complete`.

Partial composition is a successful preview invocation and does not set `isError`; configuration
or loading failures return the error envelope with `isError: true`. Preserve readable error codes,
messages and available path context without serializing arbitrary internal exception causes.
Malformed tool requests follow protocol/input-schema validation. Advertise `readOnlyHint: true`;
the implementation must satisfy the write-free evaluation contract, not rely on that annotation.
This replaces only MCP composition; other resource/tool migrations require their own caller scope.

#### Editor preview and adapter acceptance

Retain `stem.previewToSide`, selecting the active local source document and supplied unsaved content
without a frontmatter ID. The editor uses bundled core, not the CLI operation. Show composition
diagnostics on a separate diagnostic surface. Reject obsolete content and diagnostics together under
D20 for changes to any relevant supplied source/configuration, not only the active document; a new
failure must not present previous successful content as the current result.

Acceptance covers exact whitespace/no appended newline, partial preview versus blocked stdout
export, unrelated project diagnostics, missing/invalid configuration and absence of read-time writes.
Exercise MCP structured/text envelope agreement and partial-result/error mapping, plus editor unsaved
source/configuration, separate diagnostics and rejection of stale content/diagnostic updates.

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

The initial replacement analyzes freshly parsed supplied current sources and does not cache
composition results. Do not persist syntax trees or reconstruct parsed records from cached metadata
with fabricated source positions. This leaves later computation reuse possible subject to D16-D18
and D24; it does not turn external source content or output ownership into disposable computation.

The [output manifest](#output-manifest) is separate operational state: recomputing current content
cannot recover which obsolete files Stem previously wrote. Clearing computation caches must not
erase generation ownership or enable cleanup without that evidence.

### Sync records and results

Retain `stem sync` and `syncProject()`. The initial replacement discovers current sources, reads
and parses every source, builds the current graph, and replaces the derived `index.json` and
`graph.json` in the configured `cacheDir`. An unchanged file is still parsed; previous cache
contents cannot substitute for current source analysis. Later reuse requires demonstrated need
and the invariance guarantees above.

The index records source-file metadata, not cached parsed Block/View objects. The internal graph
snapshot is a position-free projection of the current graph under the
[graph contract](block-model.md#graph-construction-and-checking), retaining duplicate and invalid
definitions, containment, and inclusion occurrences, including unresolved or ambiguous references.
Do not collapse definitions by authored ID, invent a resolved target, or make files into Blocks.
References between projected records are local to that snapshot; they neither persist analysis
handles nor establish durable identity or references usable across snapshots. Persist no syntax
trees, source ranges, or reconstructed parsed records. Source-located diagnostics come from fresh
analysis. Concrete encoding and format versions belong to implementation types and validation;
they do not restore a project-configuration version field.

Missing, corrupt or incompatible computation records are rebuilt from available current sources,
without legacy-format conversion or a migration-specific error. Configuration, source-read and
cache-write failures remain operation errors; a failed write must not be reported as a successful
refresh. Read-only checking, listing and preview do not create or repair these records. This
projection is not the external namespace-snapshot format and changes none of ADR-0004's retained
decoder obligations or the separate output-ownership state.

`syncProject()` retains its operation-result envelope. On successful refresh, report actual
`scannedFiles`, `parsedFiles`, `graphNodes`, `graphEdges` and `durationMs`; remove `cachedFiles`
and the corresponding CLI wording. Successful refresh describes cache production, not source
validity or export eligibility. Graph counts reflect the graph that was projected, including
recovered definitions, rather than only uniquely addressable Blocks. Public results remain readonly.

Acceptance covers repeated unchanged runs parsing all sources, changed/deleted sources replacing
stale records, empty projects, and missing/corrupt/incompatible caches yielding the same current
graph. Exercise duplicate/invalid definitions and unresolved inclusions without loss or invented
identity; verify stored records contain no positions or analysis handles. Cover loading/write
failures, truthful result counts, and read-only operations leaving absent or damaged caches untouched.

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

### Output selectors during authoring

Local [Block rename](block-model.md#authoring-operations-and-destinations) updates configured Block
selectors that resolve to the renamed definition in the current project context. Preserve set names,
destination paths, policies, file selectors and selectors resolving to another instance. Preserve
unrelated configuration values; configuration edits participate in preflight and partial-failure
reporting alongside source edits. No output files or ownership records are rewritten by rename.

Deletion checks explicit Block selectors targeting the selected definition or its descendants as
surviving references. Force may leave those selectors dangling but never deletes their configuration
or previously generated files. A whole-file selector remains valid when a subtree is removed from
its source file; it does not by itself prohibit an intentional content edit. Neither creation nor
inclusion insertion automatically creates output sets or mappings.

### Output discovery

Use `listOutputs`, `stem list outputs [--json]` and MCP `list_outputs` to discover the current
project's configured output sets. Return each set's name, effective directory and policies, and its
explicit target selectors and destination paths, preserving target order. Include empty sets;
an absent or empty `outputSets` map produces a successful empty listing. This replaces View discovery
alongside the [reference query](block-model.md#reference-lookup), with no View compatibility alias.

Discovery validates configuration but does not resolve source selectors, compose content, inspect
destination ownership or write anything. A configured target is not proof of an available source,
an eligible export or an existing output file. Follow the shared [read-only query reporting
contract](block-model.md#read-only-cli-and-mcp-queries), including CLI JSON and MCP result agreement.
Acceptance covers both selector kinds, effective defaults, empty sets and invalid configuration,
with no source/destination reads or publication side effects beyond configuration loading.

### Output configuration example

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

### Publication selection and commands

`renderOutputs(selection, options)` replaces `renderView()` and `renderAll()` during coordinated
adapter replacement. Selection explicitly requests all local sets or a nonempty list of named sets,
each with either its complete target list or explicit configured destination paths. Omitted target
paths select the complete set; an explicit target selection remains a partial-set run even if it
happens to enumerate every target. Reject unknown sets/targets and duplicate selections before
mutation. Selecting all sets in a valid library-only project is a successful no-op.

The CLI exposes `stem render set <name> [--target <path>]` and `stem render all`. Repeat `--target`
to select several targets within that set; omit it to select the complete set. Match target paths
against configured destinations, not source IDs or process-relative filesystem paths. Destinations
and policies come from configuration; these commands do not accept a destination override. Multi-set
selection is available through the operation; the CLI needs no additional grouping syntax.

These are file-publication commands. Explicit-source preview and eligible stdout composition remain
separate, output-set-independent workflows under [preview/output separation](#preview-and-output-adapters).
Preserve those workflows during coordinated replacement. These spellings describe the accepted
replacement contract, not commands supported by the current implementation.

### Source boundary and View retirement

Retain `blocksDir`, default `"blocks"`, as the single project-relative source directory within the
project. Files there need not define Blocks. Outputs may sit elsewhere, including at the project
root, but writing into the source directory is an error; do not silently exclude an output file
from the source model to permit this overlap.

Replace the legacy View role, its separate discovery/parser paths and `viewsDir` during the
corresponding migration. Preserve authored View files; do not delete, move or convert them
automatically. Remove `viewsDir` from the supported configuration fields; a remaining setting receives
the existing generic unknown-field configuration error under the
[configuration-validation policy](block-model.md#d23-schema-retirement-transition), with no
retired-field lookup, compatibility path or migration-specific message. Files outside that directory
remain ordinary files until the author deliberately includes them in the new source layout.
The output manifest alone does not establish a Stem source project; source project identity and
configuration remain governed by [D5](project-connections.md#project-identity).

Initialization preserves the [identity lifecycle](project-connections.md#configuration-reads-and-initialization),
including force behavior. Create the single configured source directory and required Stem metadata
directory; stop creating a View directory. Ignore the configured computation cache, but add no
legacy `rendered/` ignore entry or blanket ignore for output destinations. Preserve existing authored
files and ignore entries. Initialization creates no output mappings or destination directories;
an absent `outputSets` map is valid. Remove `viewsDir` from initialization results with the runtime
replacement, without substituting another source role.

## D24. Resource budgets

Each requested output has a finite, configurable work budget and output budget, shared by all its
nested expansions. Independent requested outputs have separate allowances. Cycle detection remains
required: cycle-free repetition can still multiply output exponentially, and empty expansions can
consume substantial work without producing text.

The `limits` input has `maxWork` and `maxOutputBytes`. Both are required nonnegative safe integers;
zero is valid. Reject missing, negative, fractional, non-finite or unsafe values before traversal,
returning empty `content`, `complete: false` and an error diagnostic rather than silently clamping,
defaulting or starting unbounded evaluation. These are invocation checks, separate from exhaustion
of a valid allowance. Initial core implementation and tests supply explicit limits. Shared defaults
must be selected from measurements before user-facing callers are integrated; no numeric defaults
are established by this contract checkpoint.

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
source ranges, document copies or content-version history. Its location binds paths to that root.
The encoding below is adapter bookkeeping, not a new public domain type.

#### Manifest encoding and validation

Encode UTF-8 JSON with the envelope `{ "version": 1, "outputs": [...] }`. Each output record has
exactly these required members:

| Member      | Value                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `projectId` | Producer identity using the [project-ID format](project-connections.md#project-identity-configuration).                      |
| `outputSet` | Nonempty, case-sensitive set name; it may name a retired set.                                                                |
| `path`      | Canonical root-relative file path using `/` separators, with no empty, `.` or `..` components, backslashes or absolute form. |
| `sha256`    | Exactly 64 lowercase hexadecimal characters hashing the last successfully generated file bytes.                              |

An empty `outputs` array is valid. Reject missing members, wrong types, unknown members and invalid
values; do not coerce, trim, repair, drop records or substitute an empty inventory. A missing or
noninteger format version is corrupt; an integer version other than `1` is unsupported and its
records are not interpreted. This version belongs to the manifest format, independently of package
versions and the version-free project configuration. Both corrupt and unsupported manifests have
the root-wide failure scope specified below.

For version `1`, reject duplicate destination records, including identical records, case-only
paths, resolved aliases and file/directory-prefix collisions. Different producers cannot own the
same destination. Pure decoding checks record shape and lexical paths; the adapter additionally
applies [destination validation](#destination-paths-and-conflicts) against the actual root and
filesystem before mutation. Invalid or unresolvable ownership evidence blocks mutation of that
root, rather than authorizing partial use of its inventory. Manifest and lock paths receive the
same containment and file-symlink protections as output paths; authored targets cannot overwrite
either. A missing recorded output is not corrupt: cleanup already defines its treatment.

Hash exact bytes without line-ending or Unicode normalization. Update only confirmed changes and
preserve every unrelated valid record, including those belonging to other producers and retired
sets. Decoding does not require loading those producers or locating their source projects.

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

#### Local writer coordination

Use `<outputDir>/.stem/outputs.lock` for each resolved output root. Acquire it by exclusive creation
with Node's `open(path, "wx")`, without a preceding existence check. An existing entry or acquisition
failure blocks mutation of that root and reports failure; there is no unlocked fallback or automatic
wait/retry. Independent usable roots may still publish, subject to the run-wide pruning gate below.
Resolve root aliases to the same coordination scope and validate containment of bookkeeping paths
before creating directories or acquiring a lock. Reject known conflicts among selected destinations
before publishing any target; lock creation establishes no output ownership.

Acquire selected root locks in a deterministic order, once per resolved root. Hold acquired locks
across authoritative manifest loading, destination revalidation, publication, manifest persistence
and any cleanup. Complete publication/tracking attempts across selected roots before deciding
whether automatic pruning is permitted. Recheck paths and ownership under the lock; preliminary
reads alone do not authorize mutation. Reuse the existing safe file writer for per-file publication
and manifest replacement; it does not replace this coordination protocol.

Retain evidence of each invocation's lock ownership and release only its own lock in finalization,
including after errors. Never remove an entry whose acquisition failed or whose ownership can no
longer be established. Report release failure and preserve the actual publication/tracking outcomes;
do not describe it as a rollback. A remaining lock blocks later writers. Neither age nor a PID
authorizes automatic lock stealing. After a crash, manual removal requires confirming that writers
have stopped; removal grants no ownership and the next run still validates manifest and file state.

Read-only cleanup preview creates no directories, lock, manifest or other state. If it observes an
active lock or inconsistent reads, report that the root cannot be assessed reliably. Its observations
are advisory, not a reserved snapshot; applying cleanup always reacquires coordination and repeats
the checks. Locking coordinates cooperating local writers, not arbitrary filesystem mutation or
distributed writers. Node documents that exclusive creation may not work on network filesystems;
this protocol makes no stronger guarantee. See [Node filesystem flags](https://nodejs.org/api/fs.html#file-system-flags).

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
forced-deletion mechanism; its interface remains separate from the cleanup command below.

#### Explicit cleanup command

`stem cleanup --output-dir <dir> --set <name>` assesses one explicitly selected root/set without
writes. `--apply` requests selective cleanup after reacquiring coordination and repeating all
checks; it never treats a previous assessment as authorization based on reserved filesystem state.
The directory follows the output-root resolution rules, including project-relative and native
absolute paths. Use the producer ID from the current valid project configuration, with no arbitrary
producer-ID override. A set name may be retired, and the root may be its former destination.

The command protects all currently configured destinations, regardless of selected scope or current
set names. Applying explicit cleanup does not require regenerating a retired set or changing the
current automatic `cleanup` policy. It authorizes only the obsolete-record actions above, not
relinquishment, forced deletion, or takeover. A missing manifest reports unavailable ownership
evidence and performs no deletion; do not present it as proof that no obsolete files exist.

Assessment reports eligible deletions, already-absent obsolete records, retained paths and conflicts;
application reports confirmed deletions/record removals and failures. Both distinguish an unreliable
assessment from an empty candidate list. Edited-file conflicts and inability to assess/apply safely
produce a nonzero command exit status. File outcomes survive subsequent tracking or lock-release
errors under the reporting contract below.

### Publication bookkeeping and failures

Validate each selected destination's manifest before publication or cleanup. A missing manifest
permits tracking new successful writes but establishes no ownership of pre-existing untracked files;
a fresh empty destination needs no prior records. A corrupt or unsupported manifest blocks all
publication and cleanup for that output root. Preserve it and report the error without replacing
it with an empty inventory. Independent roots with usable state may still publish; the overall
operation reports failure.

Prepare selected eligible outputs before pruning. Generation, publication or manifest-persistence
errors suppress automatic pruning for that run, including when independent targets succeed.
Lock acquisition or loss of ownership also suppresses automatic pruning for the run. A release
failure after completed mutations is reported as such; it cannot undo publication or cleanup.
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

### Publication result reporting

`renderOutputs()` returns a dedicated readonly publication result on both success and failure;
leave unrelated operations' `OperationResult<T>` unchanged. The result carries `success`, `targets`,
`cleanup` and `errors`. Failure never discards confirmed outcomes. Before target enumeration is
possible, return empty outcomes with the configuration/selection error, not invented target results.
Implementation types/TSDoc own the concrete declarations; the required information is:

| Result part | Required information                                                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targets`   | Set name, configured path, resolved output root when available, applicable diagnostics, and status `published`, `skipped` or `not-published`. A published target separately reports whether its ownership record was persisted.                          |
| `cleanup`   | Root/set/path scope and assessed or confirmed action: preserve, eligible deletion, confirmed deletion, or removal of an already-absent obsolete record. Distinguish assessment from application and report suppressed automatic pruning with its reason. |
| `errors`    | Stable code, readable message, failing stage and available root/set/path scope. Keep composition/publication, tracking, cleanup and lock-release failures distinguishable; do not hide them only inside an untyped cause.                                |

`published` means the file write was confirmed, even if manifest persistence later failed. A skip
claims neither freshness nor new ownership. `not-published` includes ineligible results and targets
blocked by plan/root failures, with the reason retained. Preserve the same distinctions for cleanup:
a confirmed deletion followed by failed manifest persistence is still a deletion, not a rollback.
Report tracking only after its persistence succeeds; do not infer it from prepared records.

Overall success requires no failed target or operation stage; intentional skips are successful
outcomes. CLI reporting presents partial successes as well as failures and exits nonzero on overall
failure, including a late lock-release failure. Counts are derived from outcomes. Global planning
failure reports no publication; independent-root progress and automatic pruning follow the existing
[failure scopes](#publication-bookkeeping-and-failures), not a new fail-fast or transaction policy.

Integration acceptance must exercise published-but-untracked output, independent-root success after
another root fails, whole-plan collision rejection, skipped ownership preservation, suppression of
pruning after failures, and late cleanup/tracking/release errors without lost outcomes. Explicit
cleanup additionally verifies retired-root/current-target protection and zero writes during assessment,
including when directories or manifests are absent or a lock is observed.

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
