# Stem Roadmap

The sole active/deferred work register. [Governance](docs/governance.md) owns change policy; [CONTRIBUTING](CONTRIBUTING.md) owns procedures; [architecture](docs/architecture.md) routes design readers. Task state, implementation evidence, host acceptance and distribution are distinct. Completed records and prior authorizations are [historical evidence](docs/history/2026-10-repository-audit.md), not new permission to execute their old scopes.

## Current behavior and policy

### R00: Establish which status items block implementation

State: awaiting owner decisions; distribution not applicable.

- Tag-only selection without a section remains an observed limitation; see the [current reference](docs/reference.md#references-and-selection).
- Namespace identity in graph/rendering and the three legacy meanings of “tag” remain unresolved design questions. No tags-to-labels rename is approved. See [namespace work](#remaining-namespace-issues).
- Current transclusion depth/cycle policy remains unresolved; proposed Pure Block rules do not establish current behavior.
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

- Evaluate literal schema-path treatment for the identified glob reachability; reproduce against current source before choosing a fix.
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

The local external-snapshot producer is absent; internal `graph.json` and external `stem-graph.json` are different formats. CLI/editor loading policy remains duplicated. Current graph/rendering identity does not consistently retain namespace context. External snapshot exports are provisional; stricter `fetchedAt` validation would change behavior preserved by ADR-0004. Resolve the governing design before a shared loader, new producer or decoder change. [Current reference](docs/reference.md#namespace-snapshots) owns observable limitations.

## Pure Block migration

Status: design proposed; implementation and product acceptance remain deferred.
Use the [design navigation and D-label map](docs/architecture.md#proposed-pure-block-design) for contracts. Pure Block D-labels and Remediation D-labels are distinct collections.

### Documentation and decision review

Review ADR-0005/0007 with their four specifications before product acceptance. [ADR-0008](docs/decisions/0008-documentation-lifecycle.md) accepts documentation policy only; architecture owns the [current-decision map](docs/architecture.md#current-decision-applicability). [R00](#r00-establish-which-status-items-block-implementation) owns remaining policy/gate questions. ADR-0004 remains accepted in full until an accepted replacement names its superseded scope.

### Migration sequence

1. Resolve the [open design work](#pure-block-open-and-deferred-work) needed for the selected implementation slice and explicitly accept its governing product decisions and contracts.
2. At ADR-0005 acceptance, update only the affected Tag-schema rule and ADR-0004 status to identify the replaced scope; preserve external-snapshot requirements and core/I/O boundaries.
3. Prepare a bounded implementation plan for core model, syntax, composition, and public API changes, using the specifications as acceptance criteria.
4. Plan project-connection resolution and lifecycle across core and adapters under ADR-0007; resolve storage and transport mechanics before implementing those interfaces.
5. Apply the schema retirement below alongside the migration, then update CLI/editor behavior and released-user guidance with targeted validation. Implementation order and files require the subsequent code plan.

### D15. Dependency review

Defer implementation and detailed design of the dependency review feature entirely from this migration. Preserve its intent: a changed target indicates that dependent authored content may need review. Deferred feature notes, not migration requirements: dependency review inserts no content, allows cycles, and reports missing targets without itself making content incomplete; a review signal does not rewrite content or automatically make it invalid or incomplete.

Required composition refresh is specified in [D16](docs/specs/composition.md#d16-affected-results).

### D23. Schemas, structural validation, and templates

Remove the existing Tag-schema feature as part of the Pure Block migration: its validation, schema loading and configuration, initialization templates, and feature-specific public types/decoders.
The retirement choice and its rationale belong to [ADR-0005](docs/decisions/0005-pure-block-model.md#rejected).

Implement the proposed [D23 transition contract](docs/specs/block-model.md#d23-schema-retirement-transition) alongside retirement; that specification owns file preservation, unsupported-setting errors and retained validation.

Defer replacement schemas, structural validation design, and template features; their future relationship to Tags remains open.
Partial supersession and rule changes occur only on formal product acceptance as specified in
[ADR-0005](docs/decisions/0005-pure-block-model.md#consequences); this roadmap authorizes no code changes.

### Pure Block open and deferred work

- **D5 mechanics:** Concrete project/connection ID formats and generation mechanisms, source-binding field names and serialization, resolved-instance representation, supported Git transport syntax, and remote-content storage layout remain open. Command/UI details and persistence mechanisms must implement the [connection lifecycle contract](docs/specs/project-connections.md#connection-lifecycle); machine-specific local path overrides remain deferred. Recording the resolved dependency graph does not require deciding on a new lockfile or configuration syntax.
- **D5 dependency policies:** User-configurable overrides of nested dependencies and explicit mechanisms for one connection to follow another remain deferred.
- **D5 refresh scheduling:** Background polling and time-based refresh intervals remain deferred.
- **D24 defaults:** Numeric work/output budget defaults await measurement; the required behavior is in [D24](docs/specs/composition.md#d24-resource-budgets).
- **D27 shorthand:** Single-Tag shorthand is deferred pending demonstrated user need.
- **Evaluation mechanics:** Cache format and algorithm, detailed result contracts, and ID generation mechanics remain deferred.
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

Resolve the remaining R00 questions, product ADR-0005/0007 acceptance with their specifications, and the private reporting route independently. No publication or runtime change is authorized by this roadmap.

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
