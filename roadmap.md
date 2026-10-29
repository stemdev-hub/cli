# Stem Roadmap

The sole active/deferred work register. [Governance](docs/governance.md) owns change policy; [CONTRIBUTING](CONTRIBUTING.md) owns procedures; [architecture](docs/architecture.md) routes design readers. Task state, implementation evidence, host acceptance and distribution are distinct. Completed records and prior authorizations are [historical evidence](docs/history/2026-10-repository-audit.md), not new permission to execute their old scopes.

## Current behavior and policy

### R00: Establish which status items block implementation

State: legacy policy questions resolved by the accepted Pure Block contracts and ADR-0011.
Current integration acceptance is tracked [below](#integration-acceptance); deferred connection mechanics remain separate.

## Repository remediation

### R01: Use core semantics when opening a view preview

State: the owner reports manual preview tests passed with the corrected VSIX after the `tunnels` getter fix; exact host/version evidence remains unrecorded. Regression tests cover guarded API getters. Distribution: tracked by R10.

Core-based preview identification and automated checks are recorded in [historical R01](docs/history/2026-10-repository-audit.md#r01-use-core-semantics-when-opening-a-view-preview). Preserve the recorded Cursor/API evidence and its limits. Run the [preview host checklist](packages/vscode-stem/CONTRIBUTING.md#manual-test-checklist) in the selected trusted editor host, recording version, fixture and result before declaring acceptance complete.

### R02: Serialize MCP configuration separately for VS Code and Cursor

State: project-configuration preflight and stale-input rejection are implemented with regression coverage; see the [MCP setup guide](packages/vscode-stem/README.md#ai-context-server-mcp). Real-host recognition/startup acceptance remains pending. Distribution: tracked by R10.

Separate serializers and automated coverage are recorded in [historical R02](docs/history/2026-10-repository-audit.md#r02-serialize-mcp-configuration-separately-for-vs-code-and-cursor). Complete the [MCP host checklist](packages/vscode-stem/CONTRIBUTING.md#mcp-validation), distinguishing configuration recognition from server startup. Do not repeat already-recorded automated evidence as a fresh host result.

### R05: Determine the smallest justified advisory remediation

State: investigation complete; bounded follow-up work remains. Distribution: consumer exposure unverified.

The [11 October investigation](docs/history/2026-10-repository-audit.md#r05-determine-the-smallest-justified-advisory-remediation) preserves its exact environment, reachability evidence and limitations. The old lock-refresh proposal is no longer active; public Pure Block integration removes the obsolete parser dependency chain from the workspace lockfile. This is not a fresh security audit or proof of published-consumer remediation.

Remaining selection:

- The identified schema-path glob is removed by [Tag-schema retirement](#d23-schemas-structural-validation-and-templates); that specific follow-up no longer applies. This is not a new dependency advisory audit.
- Reassess production advisories in the exact selected packed consumer before a release.
- Obsolete parser dependencies are removed by the approved public Pure Block integration; this is not a new advisory audit.

Acceptance: record current reproduction, chosen smallest scope, targeted checks and consumer evidence. Reconsider when selecting dependency remediation or a release candidate.

### R09: Add package-derived CLI version reporting

State: deferred; distribution not applicable until selected. Trigger: a concrete consumer/tooling need for a version command. CLI discovery already uses `--help`; R09 does not block it. Preserve the [original proposal](docs/history/2026-10-repository-audit.md#r09-add-package-derived-cli-version-reporting) for scope and acceptance planning.

### R10: Verify an authorized release delivers selected fixes

State: consumer/distribution verification open.

Source manifests at the audit baseline record core 0.1.0, CLI 0.3.1 and extension 0.4.1. Local release tags/changelogs exist; they do not prove npm or Marketplace delivery. Prior candidate verification is [dated evidence](docs/history/2026-10-repository-audit.md#r10-verify-an-authorized-release-delivers-selected-fixes), not verification of today's artifacts.

Select exact artifacts and obtain separate release authorization where publishing is required. Verify clean-consumer imports/CLI behavior and the selected VSIX; record artifact identity, versions, platforms, host acceptance and actual delivery evidence. Follow [release procedures](CONTRIBUTING.md#release-process). Do not infer that another publish is needed solely from the old “pending” wording.

### Remaining namespace issues

State: deferred design/implementation work under Remediation D07; trigger: selection of namespace/snapshot or Pure Block connection work.

The local external-snapshot producer is absent; internal `graph.json` and external `stem-graph.json` are different formats. CLI/editor loading policy remains duplicated. Core evaluation retains supplied instance context; adapters do not yet resolve authored connection sources. External snapshot exports are provisional; stricter `fetchedAt` validation would change behavior preserved by ADR-0004. Follow accepted ADR-0007 for project connections and resolve the selected slice's open mechanics before implementation; acceptance does not replace the retained external-snapshot contract. [Current reference](docs/reference.md#namespace-snapshots) owns observable limitations.

## Pure Block migration

State: coordinated public integration committed at `48aa4b1`; editor preview acceptance follow-up is tracked under R01.
[ADR-0011](docs/decisions/0011-public-pure-block-integration.md) records the approved public boundary.
[Architecture](docs/architecture.md#pure-block-design) maps contracts and implementation.
[Private checkpoint evidence](docs/history/2026-10-pure-block-checkpoints.md) remains historical.

### Documentation and decision review

ADR-0005/0007 and four specifications were accepted at `a56203e`; later owner-approved
refinements govern identity, authoring, queries, composition and output publication. Public integration
updates current guides and generated declarations with runtime behavior. Accepted ADR bodies remain
unchanged. The [decision map](docs/architecture.md#current-decision-applicability) owns applicability.

### Integration acceptance

Verified on 28 October 2026, Windows/Node 26.12.1, against `2aa87e6` plus the approved working-tree scope:
build, typecheck, lint, 931 workspace tests (476 core, 331 CLI, 124 editor), dependency boundaries,
built-CLI smoke, documentation budgets, 11 documentation tests, executable examples, generated-reference
freshness and whitespace checks. Packed core checks, exact-tarball consumer workflows and bundled VSIX
inspection passed. [Verification procedure](CONTRIBUTING.md#verification) owns commands; source tests
own reproducible cases. Real-host acceptance remains under R01/R02 and distribution under R10.

### D15. Dependency review

Deferred. Reconsider when authors need a signal that changed content may require dependent-content
review. Such a signal inserts no content, permits cycles and does not itself invalidate composition.
Required refresh remains governed by [D16](docs/specs/composition.md#d16-affected-results).

### D23. Schemas, structural validation, and templates

Tag-schema retirement is complete under the [transition contract](docs/specs/block-model.md#d23-schema-retirement-transition).
Replacement schemas/templates remain deferred until a concrete authoring or validation need appears.

### Pure Block open and deferred work

- **D5 mechanics:** Connection storage/serialization, connection IDs, resolved revisions, Git transport
  and remote-source storage remain separate work under the [connection lifecycle](docs/specs/project-connections.md#connection-lifecycle).
  Supplied source contexts and metadata exchange do not implement those mechanics.
- **D5 extensions:** Machine-local and nested-dependency overrides, following mechanisms and background
  refresh remain deferred until a demonstrated workflow requires them.
- **Composition caching:** Fresh analysis is the current strategy. Any later cache must satisfy
  [invariance](docs/specs/composition.md#d18-disposable-computation-caches), including budgets and diagnostics.
- **Output extensions:** Per-target policies, asset rewriting/copying, partial-file generation and
  distributed coordination remain outside the initial contract.
- **D27 shorthand and formatter:** Deferred until demonstrated demand or a concrete authoring need.
- Host/consumer/distribution acceptance stays under R01, R02 and R10; namespace producer work stays
  in [remaining namespace issues](#remaining-namespace-issues).

<a id="pure-block-decisions-to-finalize"></a>
<a id="parser-and-model-contract-checkpoint"></a>
<a id="shared-file-writer-prerequisite"></a>
<a id="composition-and-adapter-contract-checkpoint"></a>
<a id="durable-project-identity-checkpoint"></a>
<a id="publication-bookkeeping-and-coordination-checkpoint"></a>
<a id="migration-sequence"></a>

Former checkpoints: [contract/code map](docs/architecture.md#pure-block-design),
[private verification evidence](docs/history/2026-10-pure-block-checkpoints.md).

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

Resolve deferred connection mechanics and the private reporting route independently. Product ADR-0005/0007 and their specifications are accepted as recorded above. No publication or runtime change is authorized by this roadmap.

## Historical navigation

These forwarding links preserve old section URLs. They carry no independent task state.

<a id="phase-1-foundational-core-updates"></a> [Phase 1: Foundational Core Updates](docs/history/2026-10-repository-audit.md#phase-1-foundational-core-updates)

<a id="phase-2-major-integrations"></a> [Phase 2: Major Integrations](docs/history/2026-10-repository-audit.md#phase-2-major-integrations)

<a id="phase-3-publishing-and-user-interface"></a> [Phase 3: Publishing and User Interface](docs/history/2026-10-repository-audit.md#phase-3-publishing-and-user-interface)

<a id="phase-4-advanced-graph-features"></a> [Phase 4: Advanced Graph Features](docs/history/2026-10-repository-audit.md#phase-4-advanced-graph-features)

<a id="audit-baseline"></a> [Audit baseline](docs/history/2026-10-repository-audit.md#audit-baseline)

<a id="finding-disposition-map"></a> [Finding disposition map](docs/history/2026-10-repository-audit.md#finding-disposition-map)

<a id="execution-order"></a> [Execution order](#repository-remediation)

<a id="shared-task-requirements-and-validation"></a> [Shared task requirements and validation](CONTRIBUTING.md#verification)

<a id="r03-resolve-the-configured-or-installed-cli-without-relying-on-version"></a> [R03: Resolve the configured or installed CLI without relying on version](docs/history/2026-10-repository-audit.md#r03-resolve-the-configured-or-installed-cli-without-relying-on-version)

<a id="r04-correct-cli-runtime-dependency-ownership"></a> [R04: Correct CLI runtime dependency ownership](docs/history/2026-10-repository-audit.md#r04-correct-cli-runtime-dependency-ownership)

<a id="input-tracing-and-bounded-reproductions"></a> [Input tracing and bounded reproductions](docs/history/2026-10-repository-audit.md#input-tracing-and-bounded-reproductions)

<a id="remedy-evaluation-and-separately-proposed-follow-up"></a> [Remedy evaluation and separately proposed follow-up](docs/history/2026-10-repository-audit.md#remedy-evaluation-and-separately-proposed-follow-up)

<a id="validation-and-evidence-identity"></a> [Validation and evidence identity](docs/history/2026-10-repository-audit.md#validation-and-evidence-identity)

<a id="r06-align-existing-repository-guidance-with-the-released-architecture"></a> [R06: Align existing repository guidance with the released architecture](docs/history/2026-10-repository-audit.md#r06-align-existing-repository-guidance-with-the-released-architecture)

<a id="r07-regenerate-the-cli-api-reference"></a> [R07: Regenerate the CLI API reference](docs/history/2026-10-repository-audit.md#r07-regenerate-the-cli-api-reference)

<a id="r08-correct-the-packaged-extension-contribution-link"></a> [R08: Correct the packaged extension contribution link](docs/history/2026-10-repository-audit.md#r08-correct-the-packaged-extension-contribution-link)

<a id="implementation-workflow"></a> [Implementation workflow](CONTRIBUTING.md#contribution-workflow)
