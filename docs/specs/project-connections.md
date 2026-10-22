# Project connections

Status: proposed. Working agreements, not accepted or implemented behavior. Governing decision:
[ADR-0007](../decisions/0007-independent-project-connections.md) (proposed). See
[architecture](../architecture.md#proposed-pure-block-design) for document ownership and D-label
navigation.

## D5. Reference context and project aliases

Unqualified references resolve in the resolved project instance containing their original source
occurrence; an explicit project qualifier selects a connection through that instance's local alias
bindings. Transclusion preserves this resolution context, regardless of the receiving project. A
resolved project instance identifies the selected source state and its dependency bindings for
evaluation.

A project may declare its own name in versioned project configuration; when connecting it to another
project, that name supplies the suggested default alias, and the consuming project may choose a
different valid alias. Unnamed projects require an explicitly supplied alias. Renaming the source's
declared name does not automatically rename existing consumer aliases. Unknown aliases are errors,
without searching other projects for a matching declared name or borrowing the receiving project's
bindings.

### Project identity

Each project has a durable internal project ID stored in its versioned configuration, distinct from
its declared name, consumer aliases, connection IDs, source bindings, and selected revisions.
Declared names and local aliases are not globally unique project identities. Project and connection
IDs and resolved instances support configuration and evaluation; Block and Tag remain the only
domain primitives.

Project creation establishes the ID. Renaming or moving a project, or making another checkout of the
same project, preserves it. Creating an intentionally independent project establishes a new project
ID. Reading or connecting to a project does not silently invent or replace its identity.

Copying configuration also copies its ID; distinguishing another checkout from an intentionally
independent project requires explicit author intent. Independent Block-copy behavior remains
governed by [D4b](block-model.md#d4b-independent-copies-and-transclusion).

Different revisions, including a local checkout with edits, may share a project ID. Shared identity
does not establish equal content and must not cause their contents to be silently merged. Connecting
the same project again preserves its project and Block IDs; it is not an independent Block copy.

### Independent source connections

Project connections support local project folders and remote Git repositories. Each connection
belongs to its consuming project and has a stable internal connection ID and a local alias, each
unique within that owner. References use the alias, not the internal ID.

Multiple connections may select the same external project at equal or different revisions within one
composed result. Updating, renaming, removing, or changing the policy of one connection must not
silently modify another connection's settings or selected dependency graph. Renaming an alias
preserves its connection ID; authored references using the old alias need updating. Failures
identify the affected connection and block only dependent exports under
[D25](composition.md#d25-export-eligibility-and-publication).

Connections to the same mutable local folder observe edits to that shared folder; independent
settings do not isolate shared files. Separate checkouts or pinned remote revisions provide separate
source states.

### Connection record and source binding

The consumer stores each connection's ID, alias, and explicit source kind with its source-specific
settings in versioned configuration. Each connection has one source binding: a local project folder
or a remote Git repository. These are alternative source kinds, not an implicit local/remote
fallback chain.

A local source binding identifies the folder that is the target project's root. It uses that working
folder's supplied content; remote revision selection and refresh policy do not pin or isolate its
files.

A remote Git source binding identifies the repository location, an optional project subdirectory,
the selected branch, tag, or commit, and the connection's update policy. Omitting the subdirectory
selects the repository root. A supplied subdirectory selects the project at that location within the
selected repository revision, allowing one repository to contain multiple Stem projects.

Keep authored selection intent distinct from recorded resolution data: a selected branch or tag
remains the selection even when its resolved commit advances. The connection ID associates the
connection with its recorded dependency resolutions; a resolved commit or shared source instance
does not replace the connection's identity. This is a logical separation, not a decision to create
separate configuration and lock files.

### Local path resolution

Stored local paths are nonempty and relative to the root of the project declaring the connection,
including for nested connections; they are not relative to the process working directory, the
configuration file's containing directory, or the receiving project. The explicit path `.` selects
the declaring project's root, and `..` may select sibling or ancestor folders. Absolute,
drive-relative, and network-rooted paths are not accepted in versioned local bindings;
machine-specific path overrides are tracked in the
[deferred design work](../../roadmap.md#pure-block-open-and-deferred-work).

Stored local paths and Git project subdirectories use `/` separators and literal path components,
without home-directory, environment-variable, or wildcard expansion. Preserve component spelling; do
not lowercase paths or equate sources by alias or path spelling alone. Adapters resolve filesystem
links and actual target locations; path normalization must not change a target through incorrect
handling of `..` across links.

### Git project paths and nested local bindings

A supplied Git project subdirectory is a nonempty path relative to the repository root at the
resolved commit; `.` selects that root. It must resolve within that repository's selected source
tree, including after following links. An absolute path or traversal outside that tree is an error,
without a fallback to a host filesystem location.

A local binding declared inside a fetched Git project resolves relative to that project's root
within the same selected repository revision. It may select another project in that repository, but
must remain within the selected source tree; it cannot depend on an unrelated host folder. For
example, `../shared` declared by a project at `projects/guide` selects `projects/shared` in that
same revision. Dependencies outside the tree require an explicit remote Git binding.

### Source validation

Resolve the exact target project root and require readable project configuration with a valid
project ID there; do not search parent or child folders for a replacement project, infer identity
from a directory name, or initialize missing configuration during reads. Report missing,
inaccessible, non-directory, or unresolvable targets, including broken or cyclic filesystem links.
Content errors within an otherwise resolved project retain
[D13](composition.md#d13-localized-recovery)/[D25](composition.md#d25-export-eligibility-and-publication)'s
localized handling.

Repository locations and branch/tag/commit selections must resolve unambiguously to the requested
source and commit. An unavailable or invalid location, selection, or project subdirectory is a
connection error; never silently select another revision, project root, or source kind. Core
validates supplied configuration and resolution data; filesystem, link, Git, and network checks
belong to adapters under ADR-0001.

### Nested dependencies and evaluation

Nested references use the selected source instance's own configuration and dependency bindings. An
alias declared in the receiving project does not override an equal alias inside included source.
Block lookup uses the resolved project instance and Block ID; project ID or alias alone does not
identify a version-specific evaluation input.

For repeatable remote composition, record resolved revisions for required indirect remote
dependencies as well as direct connections in versioned consumer data. Preserve the selected
source's declared bindings and recorded dependency selections; pinning only the direct source is
insufficient when indirect sources can change. Each evaluation uses fixed supplied inputs under
[D20](composition.md#d20-evaluation-inputs).

Resolution and refresh follow the record precedence below, preserving other connections' recorded
graphs and the source projects' configuration. See the
[deferred design work](../../roadmap.md#pure-block-open-and-deferred-work) for nested overrides and
follow relationships.

### Block reference resolution

`resolveBlockReference()` returns `BlockResolution`, a discriminated union with a readonly `status`
and readonly `diagnostics`. The status determines its target payload:

| `status`      | Payload and meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `resolved`    | `target`: exactly one addressable definition, retaining its resolved instance context.            |
| `not-found`   | No target: the required instance and source data are available, but no definition matches the ID. |
| `ambiguous`   | `candidates`: all definitions matching that ID in the selected instance, with no chosen target.   |
| `unavailable` | No target: required project context or source data is unavailable or unusable for lookup.         |

Targets and candidates use the model's [definition handles](block-model.md#definition-handles).
A `resolved` target may still have definition errors; resolution success does not establish content
completeness or export eligibility. Duplicate definitions remain ambiguous under
[D4c](block-model.md#d4c-duplicate-and-missing-ids), even when only one is otherwise valid.

Diagnostic codes distinguish causes, including unknown aliases, invalid connection configuration,
and unavailable source content. Those failures use `unavailable`; they are not evidence that a
Block ID is absent. `ambiguous` describes conflicting Block definitions, not an instruction to
choose among invalid alias bindings. Payloads are readonly and evaluation-local; this API does not
choose connection serialization, durable ID encoding, transport or storage mechanics.

### Resolution records and update scope

The selected source's configuration owns the meaning of its bindings. The consumer's recorded graph
captures the resolutions used by that connection; it cannot override source-owned aliases,
selections, or recorded dependency commits.

| Operation                                   | Resolution rule                                                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial connection or deliberate resolution | Honor the selected source's recorded dependency commits. For required remote dependencies with no source-recorded resolution, resolve their declared selections and record the results in the consumer's graph.                                               |
| Ordinary regeneration                       | Reuse the connection's recorded graph consistently with the selected source's bindings and recorded selections. Retrieve missing content at those exact commits without advancing them.                                                                       |
| Explicit update                             | Resolve the chosen direct connection according to its selection, then rebuild only its graph using the initial-resolution precedence. Source-recorded nested commits remain authoritative; dependencies without source-recorded resolutions may resolve anew. |
| Opt-in automatic refresh                    | Perform the configured update before regeneration, then evaluate the resulting fixed inputs. It does not refresh dependencies during Block expansion.                                                                                                         |

An update can therefore change a dependency without a source-recorded resolution even if the direct
commit remains the same. It cannot independently advance a nested commit recorded by that source.
Importing a project does not run its own refresh workflow to replace its recorded selections.

Missing or inconsistent required resolution records are connection errors during ordinary
regeneration. Require a deliberate resolution/update operation instead of guessing a revision,
silently repairing records, or substituting the latest branch state. Invalid source records remain
errors rather than permission to override upstream choices. A changed binding must have a matching
resolution before dependent exports can succeed. This differs from missing locally stored content,
which may be retrieved at the already recorded revision.

Local working-folder content still enters each evaluation as supplied; these remote-resolution
records do not freeze local files. Connection operations retain the failure and coherent-publication
rules in [connection lifecycle](#connection-lifecycle).

### Resolved-instance graph

Represent resolved dependencies as a finite graph of instances and bindings. Reuse an existing node
on a revisit when its selected source state and dependency context match; do not allocate a fresh
instance merely because traversal follows another alias or path. Project ID alone is insufficient,
and equal source commits with different dependency selections remain distinct evaluation inputs.
Graph identity must support revisits without requiring an infinitely expanded dependency tree.

A back-edge in this graph is not itself a composition error. Block expansion applies
[D12](composition.md#d12-expansion-cycles) to the active Block-instance path. Graph representation
and ID encoding remain implementation mechanics; storage sharing must still preserve each
connection's independent update lifecycle.

### Shared content and duplicate connections

Equivalent immutable source inputs may share downloads and in-memory parsed data. Reusing composed
results additionally requires matching dependency resolution context and all relevant inputs under
[D17](composition.md#d17-result-dependencies-and-propagation)-D18. Shared storage or computation
must not couple connection settings or advance another connection's selected state.

Same-source connections at equal revisions are valid. Different selections or update policies may
currently resolve to the same commit and later diverge. Connections with equivalent source bindings,
selections, policies, and dependency contexts may receive a nonblocking informational notice when
added; do not emit a persistent warning merely for equal resolved commits or automatically merge
their configuration.

Duplicate aliases or connection IDs within one owner are configuration errors; never silently choose
a binding. Equal Block IDs in separately selected instances are governed by
[D4c](block-model.md#d4c-duplicate-and-missing-ids), not treated as duplicate connection
configuration.

### Remote revisions and refresh

On establishing a remote Git connection, obtain the selected source content locally and record its
resolved commit in versioned consumer data. Composition reuses that locally stored content
consistently throughout an evaluation ([D20](composition.md#d20-evaluation-inputs)). Fetched source
content is an input, distinct from [D18](composition.md#d18-disposable-computation-caches)'s
disposable computation cache.

The consuming project chooses an update policy per connection. Explicit updates are the default:
regeneration reuses the recorded graph, and a deliberate update resolves the recorded selection
under [resolution precedence](#resolution-records-and-update-scope). Automatic refresh is opt-in:
refresh the selected branch or tag before a requested regeneration, then use the resulting graph
throughout that evaluation. A connection pinned to a commit remains on that direct commit until its
selection changes; nested resolution follows the same precedence.

If locally stored content for a selected revision is missing, retrieve that recorded revision
without silently advancing it; report a failure if it cannot be obtained. A required refresh failure
must be reported and must not silently export older content as current
([D19](composition.md#d19-current-results),
[D25](composition.md#d25-export-eligibility-and-publication)). Previously retrieved content may
remain available for an explicitly selected offline or pinned evaluation.

Editor recomputation reuses the selected content; a refresh supplies new inputs for subsequent
evaluations ([D20](composition.md#d20-evaluation-inputs)). See the
[deferred design work](../../roadmap.md#pure-block-open-and-deferred-work) for polling and
intervals.

### Connection lifecycle

Adding a connection validates its source binding and exact target project root, establishes a fresh
connection ID, and records the target project ID with the initial resolution. Use the source's
declared name as the default alias only when valid and unused; otherwise require an explicit valid
unused alias, without overwriting a connection or silently changing the name. If no Git selection is
supplied, resolve the repository's advertised default branch once and record its branch name;
require an explicit selection if that cannot be determined.

Renaming an alias preserves the connection ID, source binding, policy, and recorded resolutions.
Validate alias uniqueness before changing the binding. Existing authored references to the old alias
require an explicit source edit or refactoring; renaming does not implicitly rewrite source or
retain a hidden fallback alias. Included projects' own bindings and references remain unchanged.

An explicit remote update affects only the chosen connection according to its recorded selection,
refresh policy and [resolution precedence](#resolution-records-and-update-scope). A direct commit
selection does not advance. Changing a branch, tag, commit, repository location, project subdirectory,
or local target path is a deliberate connection edit; validate and resolve the replacement before
publishing its matching configuration and resolution. Preserve the connection ID when editing that
connection.

Ordinary refresh and local-source rereads must match the recorded target project ID. An unexpected
change of project identity is a connection error, even if the alias, path, or repository location is
unchanged. A deliberate rebind may accept a different target project ID and replace the old
resolution; it does not copy or rewrite the source project's identities. Changing source kind
requires the settings appropriate to the new kind.

Changing only the update policy preserves the current selection and recorded resolution; automatic
refresh takes effect on the next requested regeneration. Alias renaming, policy-only edits, and
removal do not require the source to be online. Local content changes enter later evaluations under
[D20](composition.md#d20-evaluation-inputs) rather than an operation silently checking out or
rewriting the user's working folder.

Removing a connection removes its binding and connection-owned resolution references. Preserve
authored inclusions, source folders, and content still used by other connections; subsequent
references to the removed alias report an unknown-alias error. Unreferenced stored content may be
reclaimed separately. Adding a connection again creates a fresh connection ID, even when its alias
or source matches a removed connection.

Connection-management operations publish matching configuration and resolution data as one coherent
logical change. Validation, retrieval, or persistence failure preserves the previous coherent
connection state and reports that the operation was not applied; a failed required refresh still
blocks affected regeneration under
[D19](composition.md#d19-current-results)/[D25](composition.md#d25-export-eligibility-and-publication).
Reject stale operation completions that would overwrite newer connection edits. Direct configuration
edits are validated as supplied, without silently restoring or repairing authored settings.

## Open mechanics

Concrete formats and mechanisms remain in the
[deferred design work](../../roadmap.md#pure-block-open-and-deferred-work). The decision's rationale
and precedents belong to [ADR-0007](../decisions/0007-independent-project-connections.md).

## Worked example of independent revisions

A consumer connects to project P twice, through aliases `stable` and `trial`, with different owner-assigned connection IDs and selected revisions. Both selections may contain a Block with the same durable ID; lookup remains scoped to the selected resolved instance, so this alone is not a duplicate-definition error.

Refreshing `trial` leaves `stable`'s selected revision and dependency bindings unchanged. The implementation may share immutable content without coupling refresh settings. An inclusion originating in P retains P's reference context rather than adopting the consumer's aliases.

For nested resolution, suppose both connections initially select Guide revision A, whose versioned
records select Shared revision X. Guide revision B records Shared revision Y. Updating only `trial`
to B gives:

```text
stable -> Guide A -> Shared X
trial  -> Guide B -> Shared Y
```

Updating a connection that remains on A preserves X, even if Shared's branch has advanced. If A
declares a Shared branch without recording a commit, initial resolution records a commit in the
consumer graph; ordinary regeneration reuses it, while a deliberate update may resolve that branch
again. Deleting the required consumer resolution does not make ordinary regeneration select latest.

If the resolved graph revisits the same source state with the same dependency context, the edge
returns to that existing instance. A different context remains distinct. Whether that graph cycle
causes a composition error depends on the selected Blocks' expansion paths.

These examples illustrate the proposed D5 contract. They choose no connection-file syntax,
ID-generation scheme, storage layout or transport mechanism.
