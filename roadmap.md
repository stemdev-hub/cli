# Stem Roadmap

The sole active/deferred work register. [Governance](docs/governance.md) owns change policy; [CONTRIBUTING](CONTRIBUTING.md) owns procedures; [architecture](docs/architecture.md) routes design readers. Task state, implementation evidence, host acceptance and distribution are distinct. Completed records and prior authorizations are [historical evidence](docs/history/2026-10-repository-audit.md), not new permission to execute their old scopes.

## Current behavior and policy

### R00: Establish which status items block implementation

State: awaiting owner decisions; distribution not applicable.

- Tag-only selection without a section remains an observed limitation; see the [current reference](docs/reference.md#references-and-selection).
- Namespace identity in graph/rendering and the three legacy meanings of “tag” remain unresolved design questions. No tags-to-labels rename is approved. See [namespace work](#remaining-namespace-issues).
- Current transclusion depth/cycle policy remains unresolved; accepted Pure Block rules do not establish current behavior.
- The owner's previous extension-remediation gate waiver remains evidence in [historical R01](docs/history/2026-10-repository-audit.md#r01-use-core-semantics-when-opening-a-view-preview); it is not a general implementation waiver.

Acceptance: owner disposes of the remaining policy/gate questions. See [prior corrections](docs/history/2026-10-repository-audit.md#assessment-corrections) and [resolved decisions](docs/history/2026-10-repository-audit.md#follow-up-corrections-20-october-2026).

## Repository remediation

### R01: Use core semantics when opening a view preview

State: implementation complete; real-host acceptance pending. Distribution: tracked by R10.

Core-based preview identification and automated checks are recorded in [historical R01](docs/history/2026-10-repository-audit.md#r01-use-core-semantics-when-opening-a-view-preview). Preserve the recorded Cursor/API evidence and its limits. Run the [preview host checklist](packages/vscode-stem/CONTRIBUTING.md#manual-test-checklist) in the selected trusted editor host, recording version, fixture and result before declaring acceptance complete.

### R02: Serialize MCP configuration separately for VS Code and Cursor

State: implementation complete; real-host recognition/startup acceptance pending. Distribution: tracked by R10.

Separate serializers and automated coverage are recorded in [historical R02](docs/history/2026-10-repository-audit.md#r02-serialize-mcp-configuration-separately-for-vs-code-and-cursor). Complete the [MCP host checklist](packages/vscode-stem/CONTRIBUTING.md#mcp-validation), distinguishing configuration recognition from server startup. Do not repeat already-recorded automated evidence as a fresh host result.

### R05: Determine the smallest justified advisory remediation

State: investigation complete; bounded follow-up work remains. Distribution: consumer exposure unverified.

The [11 October investigation](docs/history/2026-10-repository-audit.md#r05-determine-the-smallest-justified-advisory-remediation) preserves its exact environment, reachability evidence and limitations. Current lockfile observation: `js-yaml@3.15.2` is already present after the dependency update; the old lock-refresh proposal is no longer an active task. This is not a fresh security audit or proof of published-consumer remediation.

Remaining selection:

- The identified schema-path glob is removed by [Tag-schema retirement](#d23-schemas-structural-validation-and-templates); that specific follow-up no longer applies. This is not a new dependency advisory audit.
- Reassess production advisories in the exact selected packed consumer before a release.
- Gray-matter removal or a scanner replacement needs a bounded proposal justified by actual behavior/API effects; no removal is authorized here.

Acceptance: record current reproduction, chosen smallest scope, targeted checks and consumer evidence. Reconsider when selecting dependency remediation or a release candidate.

### R09: Add package-derived CLI version reporting

State: deferred; distribution not applicable until selected. Trigger: a concrete consumer/tooling need for a version command. CLI discovery already uses `--help`; R09 does not block it. Preserve the [original proposal](docs/history/2026-10-repository-audit.md#r09-add-package-derived-cli-version-reporting) for scope and acceptance planning.

### R10: Verify an authorized release delivers selected fixes

State: consumer/distribution verification open.

Source manifests at the audit baseline record core 0.1.0, CLI 0.3.1 and extension 0.4.1. Local release tags/changelogs exist; they do not prove npm or Marketplace delivery. Prior candidate verification is [dated evidence](docs/history/2026-10-repository-audit.md#r10-verify-an-authorized-release-delivers-selected-fixes), not verification of today's artifacts.

Select exact artifacts and obtain separate release authorization where publishing is required. Verify clean-consumer imports/CLI behavior and the selected VSIX; record artifact identity, versions, platforms, host acceptance and actual delivery evidence. Follow [release procedures](CONTRIBUTING.md#release-process). Do not infer that another publish is needed solely from the old “pending” wording.

### Remaining namespace issues

State: deferred design/implementation work under Remediation D07; trigger: selection of namespace/snapshot or Pure Block connection work.

The local external-snapshot producer is absent; internal `graph.json` and external `stem-graph.json` are different formats. CLI/editor loading policy remains duplicated. Current graph/rendering identity does not consistently retain namespace context. External snapshot exports are provisional; stricter `fetchedAt` validation would change behavior preserved by ADR-0004. Follow accepted ADR-0007 for project connections and resolve the selected slice's open mechanics before implementation; acceptance does not replace the retained external-snapshot contract. [Current reference](docs/reference.md#namespace-snapshots) owns observable limitations.

## Pure Block migration

Status: design accepted; parser/model and composition replacement remain pending. Shared cycle tracking and Tag-schema retirement are implemented as bounded prerequisites; open mechanics and deferred work remain below.
Use the [design navigation and D-label map](docs/architecture.md#proposed-pure-block-design) for contracts. Pure Block D-labels and Remediation D-labels are distinct collections.

### Documentation and decision review

On 23 October 2026, the owner explicitly accepted ADR-0005, ADR-0007, and all four specifications
as recorded at revision `a56203e`, retaining their explicitly open mechanics and deferred work.
ADR statuses record acceptance, ADR-0002's full supersession, and ADR-0004's partial Tag-schema
supersession; its external-snapshot requirements remain binding. This checkpoint changes no runtime
behavior and establishes neither host acceptance nor distribution.

[ADR-0008](docs/decisions/0008-documentation-lifecycle.md) owns documentation policy; architecture
owns the [current-decision map](docs/architecture.md#current-decision-applicability).
[R00](#r00-establish-which-status-items-block-implementation) retains remaining legacy policy/gate
questions. The owner updated the protected [core instructions](packages/core/AGENTS.md) in
`ea7584a` to point to the accepted decision applicability.

### Pure Block decisions to finalize

Review checkpoint: 21 October 2026. The owner confirmed direct replacement under the [beta axiom](docs/axioms.md), replacing the review's earlier additive-parser recommendation. That direction and proposed policy retirements are now recorded in [ADR-0005](docs/decisions/0005-pure-block-model.md).

Review items 3–7 below correspond to the design-review discussion, not new D-labels. All five were agreed in chat and incorporated into the proposals on 22 October 2026. Those revisions left statuses proposed and did not themselves establish product acceptance or authorize implementation; formal acceptance is recorded above.

| Review item                     | Incorporated outcome                                                                                                                             | Owning contract                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3. Parser recovery              | Header, EOF and ancestor recovery, with exact examples and whitespace treatment.                                                                 | [Syntax recovery](docs/specs/stem-syntax.md#invalid-headers-and-ownership-recovery), [boundary whitespace](docs/specs/stem-syntax.md#boundary-whitespace)                                                                                                                                         |
| 4. Invalid-definition selection | Explicit ambiguity, diagnostic scope and partial Tag classification.                                                                             | [Model D4c](docs/specs/block-model.md#d4c-duplicate-and-missing-ids), [D10](docs/specs/block-model.md#d10-id-and-tag-selection), [syntax D28](docs/specs/stem-syntax.md#d28-tag-diagnostics-and-recovery), [export eligibility](docs/specs/composition.md#d25-export-eligibility-and-publication) |
| 5. Composition output           | Definition emission, failed-occurrence output and ordinary-text frontmatter.                                                                     | [Composition D11–D14](docs/specs/composition.md#d11-inclusion), [frontmatter](docs/specs/stem-syntax.md#file-level-frontmatter), [proposed retirement](docs/decisions/0005-pure-block-model.md#consequences)                                                                                      |
| 6. Resource budgets             | Logical work/UTF-8 accounting, cache invariance and deterministic exhaustion. Numeric defaults still await measurement in the composition slice. | [Composition D18/D24](docs/specs/composition.md#d24-resource-budgets)                                                                                                                                                                                                                             |
| 7. Connection resolution        | Source-record precedence, regeneration/update scope and finite instance graphs.                                                                  | [Resolution lifecycle](docs/specs/project-connections.md#resolution-records-and-update-scope), [instance graph](docs/specs/project-connections.md#resolved-instance-graph), [ADR-0007](docs/decisions/0007-independent-project-connections.md)                                                    |

API and representation review checkpoint: on 22 October 2026, the owner approved the naming/result recommendations and the six follow-up contracts for ordered syntax, explicit recovery, separate identity/context, operation-specific results, diagnostic ownership and fixed evaluation inputs. These working agreements were incorporated into the proposals below without changing their statuses or authorizing runtime implementation at that checkpoint; formal acceptance is recorded above.

- **Parsing and recovery:** [parser input/result contract](docs/specs/stem-syntax.md#parser-contract) and [syntax-tree representation](docs/specs/stem-syntax.md#syntax-tree-representation).
- **Identity and analysis:** [temporary definition handles](docs/specs/block-model.md#definition-handles) and [project analysis](docs/specs/block-model.md#project-analysis).
- **Resolution and selection:** [BlockResolution](docs/specs/project-connections.md#block-reference-resolution) and [findBlocksByTag() results](docs/specs/block-model.md#selection-results).
- **Diagnostics and evaluation:** [diagnostic ownership](docs/specs/composition.md#diagnostic-contract), [CompositionResult](docs/specs/composition.md#d14-completeness-and-validity), and [input/result lifetime](docs/specs/composition.md#d20-evaluation-inputs).

Output/publication review checkpoint: on 23 October 2026, the owner approved incorporating the
document-assembly, output-set, external-destination and selective-cleanup working agreements into
the proposals, including failure scope for invalid manifests and conflicting destinations.
That checkpoint left statuses proposed and did not authorize runtime implementation; formal
acceptance is recorded above.

- **Assembly and configuration:** [output sets and explicit source selectors](docs/specs/composition.md#output-sets-and-targets), with [one source boundary and View retirement](docs/specs/composition.md#source-boundary-and-view-retirement).
- **Publication:** [destination checks](docs/specs/composition.md#destination-paths-and-conflicts) and [existing-file policies](docs/specs/composition.md#existing-file-policy).
- **Persistence and cleanup:** [destination-local manifest](docs/specs/composition.md#output-manifest), [obsolete-output rules](docs/specs/composition.md#obsolete-output-cleanup), and [failure handling](docs/specs/composition.md#publication-bookkeeping-and-failures).
- **Acceptance examples:** [output publication scenarios](docs/specs/composition.md#output-publication-examples), alongside the existing syntax, selection and composition examples.

Next is the bounded unified parser/model plan in the [migration sequence](#migration-sequence).
Use the specifications' examples as acceptance cases, including the linked publication scenarios.
API naming follow-up: the owner agreed to recheck remaining API/type names when their concrete
contracts and callers need them, before implementing the corresponding slice. Update affected
specifications at that point; the [parser contract](docs/specs/stem-syntax.md#parser-contract) and
[Tag-selection contract](docs/specs/block-model.md#selection-results) already reflect the
result-wrapper refinement, with the approved Tag-query function and field names in the latter.
Agreed behavior remains unchanged; formal acceptance is recorded above. Finalize any remaining
slice-specific declarations against their callers before implementing them.

On 24 October 2026, the owner confirmed retaining durable project identity after reviewing its
editing/copying tradeoffs. Its uses remain owned by the [connection lifecycle](docs/specs/project-connections.md#connection-lifecycle)
and [output ownership contract](docs/specs/composition.md#output-manifest). The parser/model slice
operates on supplied source and project/instance context; project-ID generation, persistence and
initialization changes are not prerequisites for that bounded work. Implement the durable identity
lifecycle before enabling connection identity checks or producer-owned publication/cleanup.
This sequencing preserves the accepted identity contract; it introduces no dummy IDs, path-derived
durable IDs or compatibility fallback. Incorporate the approved project-ID implementation
recommendations into the owning specification when selecting that lifecycle slice, before code.

On 24 October 2026, the owner approved preserving useful workflows during replacement, superseding
the chat proposal to withdraw commands and editor preview to shrink the parser/model checkpoint.
Retain graph construction, validation and cycle detection, including their existing public names
where the responsibilities still apply; replace obsolete representations and rules directly.
Core owns the [shared cycle mechanism](docs/specs/composition.md#d12-expansion-cycles).
The revised implementation plan must map each affected workflow to its working replacement before
integration, retaining only the explicitly accepted concept retirements. A parser/model-only
integration cannot promise full workflow continuity without its dependent replacement work.

The first bounded preparation updates the existing core cycle detector: preserves its public contract,
extracts reusable internal active-path tracking, and uses iterative traversal for deep graphs.
Verified on 24 October 2026: workspace build, typecheck, lint, dependency boundaries, 294 core,
267 CLI and 160 editor tests, built-CLI smoke, documentation checks and whitespace checks passed.
Sandbox access failures and timed-out integration files passed on isolated unrestricted reruns;
test limits were unchanged. This does not implement Pure Block graph identity, parsing or composition;
the composition caller will reuse the mechanism when that slice is implemented. No command removal,
compatibility alias, new public helper or persistent identity mechanism is part of this checkpoint.

Budget defaults are needed for composition, not an earlier parser/model slice. Connection formats, storage and transport are needed only when selecting that implementation slice; dependency review, replacement schemas/templates, shorthand, formatting and background refresh remain deferred below.

### Migration sequence

1. Resolve the [open design work](#pure-block-open-and-deferred-work) and replacement API contracts needed for the selected implementation slice within the accepted decisions and specifications.
2. Acceptance bookkeeping is complete in ADR statuses, rules and the architecture applicability map. Carry out the corresponding runtime retirements in the selected implementation slice, preserving external-snapshot requirements and core/I/O boundaries.
3. Prepare a bounded implementation plan for core model, syntax, composition, and public API changes, mapping contracts to core, CLI and editor callers and naming exact files. Begin with unified parsing/model prerequisites; use the specification examples as acceptance criteria, with obsolete-editor-result checks and representative large/deep inputs where relevant.
4. Plan project-connection resolution and lifecycle across core and adapters under ADR-0007; resolve storage and transport mechanics before implementing those interfaces.
5. Apply the schema retirement below alongside the migration, then update CLI/editor behavior and released-user guidance with targeted validation. Implementation order and files require the subsequent code plan.
6. Implement output selection and publication after their parsing/composition and identity prerequisites; establish manifest tracking before enabling pruning. Retire the legacy View role with authored-file preservation, then update current command/configuration guides. Resolve the slice's [open mechanics](#pure-block-open-and-deferred-work) in its bounded code plan.

### D15. Dependency review

Defer implementation and detailed design of the dependency review feature entirely from this migration. Preserve its intent: a changed target indicates that dependent authored content may need review. Deferred feature notes, not migration requirements: dependency review inserts no content, allows cycles, and reports missing targets without itself making content incomplete; a review signal does not rewrite content or automatically make it invalid or incomplete.

Required composition refresh is specified in [D16](docs/specs/composition.md#d16-affected-results).

### D23. Schemas, structural validation, and templates

State: implementation and local verification complete. Distribution and real-host acceptance are not established.

On 24 October 2026, the owner approved the bounded retirement under
[ADR-0005](docs/decisions/0005-pure-block-model.md#rejected) and the
[D23 transition contract](docs/specs/block-model.md#d23-schema-retirement-transition).
Core decoder/validator exports and types, schema collections in analysis, CLI/editor schema loading,
configuration/defaults, initialization templates and schema-specific watcher patterns are removed directly.
The owner refined this plan to validate all configuration keys against supported fields, including
namespace-entry fields, using existing configuration errors without retired-field lookups or
migration-specific messages. Unknown fields and typos are rejected consistently in core, CLI and
editor. The specification owns that policy, authored-file preservation and ordinary Markdown discovery.
The existing authoring, graph, rendering, preview and external-snapshot workflows remain available.
No replacement schema feature, parser change, compatibility stub or dependency change is included.

Verification on 24 October 2026 against base `635e833` plus this working-tree change, on Windows
with Node.js 26.12.1 and pnpm 11.25.0: build, typecheck, lint, dependency boundaries, built CLI smoke,
documentation checks, budgets and whitespace checks passed. The sequential suite passed 280 core,
247 CLI and 155 editor tests; documentation tests passed all 11. Local core/CLI tarball checks
(publint, ESM declaration resolution and dependency specifiers) and VSIX bundle/exclusion inspection
passed for source versions core 0.1.0, CLI 0.3.1 and extension 0.4.1. Earlier sandbox access and
concurrent-rebuild failures were resolved before these passing runs. A clean installed consumer,
real editor host and registry/Marketplace delivery remain unverified.

Defer replacement schemas, structural validation design, and template features; their future relationship to Tags remains open.
Partial supersession and rule changes are recorded following formal acceptance of
[ADR-0005](docs/decisions/0005-pure-block-model.md#consequences); external-snapshot obligations remain binding.

### Pure Block open and deferred work

- **D5 mechanics:** Project-ID specification incorporation and implementation follow the [identity sequencing checkpoint](#pure-block-decisions-to-finalize). Connection ID formats and generation mechanisms, source-binding field names and serialization, resolved-instance representation, supported Git transport syntax, and remote-content storage layout remain open. Command/UI details and persistence mechanisms must implement the [connection lifecycle contract](docs/specs/project-connections.md#connection-lifecycle); machine-specific local path overrides remain deferred. Recording the resolved dependency graph does not require deciding on a new lockfile or configuration syntax.
- **D5 dependency policies:** User-configurable overrides of nested dependencies and explicit mechanisms for one connection to follow another remain deferred.
- **D5 refresh scheduling:** Background polling and time-based refresh intervals remain deferred.
- **D24 defaults:** Numeric work/output budget defaults await measurement; the required behavior is in [D24](docs/specs/composition.md#d24-resource-budgets).
- **D27 shorthand:** Single-Tag shorthand is deferred pending demonstrated user need.
- **Evaluation mechanics:** Cache format and algorithm remain deferred; durable ID generation work follows D5 above. Result and representation contracts are incorporated; caller/declaration mapping and bounded implementation planning are next in the [API review checkpoint](#pure-block-decisions-to-finalize).
- **Output/publication mechanics:** Concrete command spellings, public declarations, manifest record encoding/validation and local writer-coordination mechanics are required when selecting that slice; behavior is owned by the [publication contract](docs/specs/composition.md#d25-export-eligibility-and-publication).
- **Output extensions:** Per-target policy overrides, asset copying/link rewriting, partial-file generation and distributed writer coordination are outside this initial contract. Reconsider only for a demonstrated consumer workflow; the output plan does not select them. Rejected assembly/profile alternatives remain owned by ADR-0005.
- **Formatter:** An optional future feature; detailed design is deferred, and parsing, validation, and export do not require it.
- Dependency review and replacement validation/templates remain owned by D15 and D23 above.

## Deferred and rejected suggestions

Identifiers here are **Remediation** D-labels, not the Pure Block proposal. Rejected/completed records remain discoverable in [history](docs/history/2026-10-repository-audit.md#deferred-and-rejected-suggestions).

| ID  | Deferred work                                                         | Reconsider when                                                                                     |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| D02 | Package `repository.directory` metadata                               | Next targeted package-metadata maintenance; unrelated to the fixed VSIX contribution link           |
| D04 | Consolidate internal filesystem-operation types                       | A concrete maintenance or behavior benefit is demonstrated                                          |
| D06 | Inventory legacy extension helpers and JavaScript-entry typechecking  | Selecting extension maintenance with usage/test evidence                                            |
| D07 | Namespace loader, local external producer, stricter snapshot handling | [Namespace work](#remaining-namespace-issues) is selected and its governing choices resolved        |
| D08 | Cosmetic outer-checkout rename                                        | Owner explicitly requests it and local/editor path impacts are understood                           |
| D10 | Tool upgrades for historical warnings                                 | Warnings reproduce and create a concrete maintenance issue; age alone is insufficient               |
| D11 | Broader platform/runtime certification                                | A supported consumer needs evidence beyond the recorded platforms; core portability remains binding |
| D12 | Ignored caches/build outputs/local material                           | Owner selects exact paths; inventory is not deletion permission                                     |

See [completed D01](docs/history/2026-10-repository-audit.md#consumer-residue-cleanup-20-october-2026). Completed D03 (core README), rejected D05 (new MCP package), rejected D09 (identity/package restructuring), and retained K01 boundaries are in history. Their disposition is not another active task.

## Product candidates

These are deferred ideas, not accepted syntax or delivery commitments. Select a bounded design only when the stated need appears.

| Candidate                        | Reconsider when                                                             |
| -------------------------------- | --------------------------------------------------------------------------- |
| Live code references             | A concrete workflow needs source excerpts with reliable update semantics    |
| HTML export and publishing       | Markdown output is insufficient for a real publishing consumer              |
| Local web UI / graph browsing    | CLI/editor navigation cannot answer recurring user questions                |
| Localization                     | A project needs multiple language editions and explicit fallback rules      |
| External OpenAPI/GraphQL sources | A demonstrated source integration justifies mapping into the existing model |

Completed namespace syntax, snapshot exchange, JSON output and MCP milestones are preserved in history. Future ideas must respect the Block/Tag axioms and accepted package boundaries.

## Documentation and community adoption

The documentation migration is recorded in [dated verification evidence](docs/history/2026-10-repository-audit.md#migration-verification-20-october-2026). [Governance](docs/governance.md) owns the resulting policy; only the adoption decisions below remain active here.

| Candidate                                                               | Trigger / disposition                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Private security reporting / SECURITY.md                                | Owner chooses and monitors a private route; then document realistic supported scope. Route remains undecided. |
| Standalone code of conduct                                              | Defined reporting/enforcement ownership before regular external participation or active community recruitment |
| Issue forms / PR template                                               | Repeated incomplete reports/submissions despite contribution guidance                                         |
| CODEOWNERS                                                              | A second maintainer can review an owned area                                                                  |
| Documentation site                                                      | Demonstrated navigation/search or external-usage need justifies publishing maintenance                        |
| Separate tutorials/how-tos                                              | Several independent workflows make package guides difficult to navigate                                       |
| Generated API website                                                   | Published declarations and examples no longer meet integrator needs                                           |
| Separate maintainer handbook                                            | Contribution/release guidance develops independently maintained responsibilities                              |
| Separate FAQ/glossary/RFC/PRD/SRS, root changelog, mandatory dogfooding | No present need; use existing owners. Reconsider only for a concrete unmet question.                          |

### Human decisions

Resolve the remaining R00 questions, slice-specific open mechanics, and the private reporting route independently. Product ADR-0005/0007 and their specifications are accepted as recorded above. No publication or runtime change is authorized by this roadmap.

## Historical navigation

These forwarding links preserve old section URLs. They carry no independent task state.

<a id="phase-1-foundational-core-updates"></a>

- [Phase 1: Foundational Core Updates](docs/history/2026-10-repository-audit.md#phase-1-foundational-core-updates)

<a id="phase-2-major-integrations"></a>

- [Phase 2: Major Integrations](docs/history/2026-10-repository-audit.md#phase-2-major-integrations)

<a id="phase-3-publishing-and-user-interface"></a>

- [Phase 3: Publishing and User Interface](docs/history/2026-10-repository-audit.md#phase-3-publishing-and-user-interface)

<a id="phase-4-advanced-graph-features"></a>

- [Phase 4: Advanced Graph Features](docs/history/2026-10-repository-audit.md#phase-4-advanced-graph-features)

<a id="audit-baseline"></a>

- [Audit baseline](docs/history/2026-10-repository-audit.md#audit-baseline)

<a id="finding-disposition-map"></a>

- [Finding disposition map](docs/history/2026-10-repository-audit.md#finding-disposition-map)

<a id="execution-order"></a>

- [Execution order](#repository-remediation)

<a id="shared-task-requirements-and-validation"></a>

- [Shared task requirements and validation](CONTRIBUTING.md#verification)

<a id="r03-resolve-the-configured-or-installed-cli-without-relying-on-version"></a>

- [R03: Resolve the configured or installed CLI without relying on version](docs/history/2026-10-repository-audit.md#r03-resolve-the-configured-or-installed-cli-without-relying-on-version)

<a id="r04-correct-cli-runtime-dependency-ownership"></a>

- [R04: Correct CLI runtime dependency ownership](docs/history/2026-10-repository-audit.md#r04-correct-cli-runtime-dependency-ownership)

<a id="input-tracing-and-bounded-reproductions"></a>

- [Input tracing and bounded reproductions](docs/history/2026-10-repository-audit.md#input-tracing-and-bounded-reproductions)

<a id="remedy-evaluation-and-separately-proposed-follow-up"></a>

- [Remedy evaluation and separately proposed follow-up](docs/history/2026-10-repository-audit.md#remedy-evaluation-and-separately-proposed-follow-up)

<a id="validation-and-evidence-identity"></a>

- [Validation and evidence identity](docs/history/2026-10-repository-audit.md#validation-and-evidence-identity)

<a id="r06-align-existing-repository-guidance-with-the-released-architecture"></a>

- [R06: Align existing repository guidance with the released architecture](docs/history/2026-10-repository-audit.md#r06-align-existing-repository-guidance-with-the-released-architecture)

<a id="r07-regenerate-the-cli-api-reference"></a>

- [R07: Regenerate the CLI API reference](docs/history/2026-10-repository-audit.md#r07-regenerate-the-cli-api-reference)

<a id="r08-correct-the-packaged-extension-contribution-link"></a>

- [R08: Correct the packaged extension contribution link](docs/history/2026-10-repository-audit.md#r08-correct-the-packaged-extension-contribution-link)

<a id="implementation-workflow"></a>

- [Implementation workflow](CONTRIBUTING.md#contribution-workflow)
