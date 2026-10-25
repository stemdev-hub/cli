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

State: design accepted; coordinated parser/model, composition and adapter replacement remains pending.
Shared cycle tracking, Tag-schema retirement, safe file writing and durable project identity are
implemented and locally verified. Host/consumer/distribution gaps remain under R01, R02 and R10.
[Architecture](docs/architecture.md#proposed-pure-block-design) maps the contracts; the
[checkpoint record](docs/history/2026-10-pure-block-checkpoints.md) preserves acceptance and verification evidence.

### Documentation and decision review

ADR-0005, ADR-0007 and all four specifications were accepted at `a56203e` on 23 October 2026.
Later approved refinements are recorded in [history](docs/history/2026-10-pure-block-checkpoints.md#acceptance-and-scope).
The [decision map](docs/architecture.md#current-decision-applicability) owns applicability;
[R00](#r00-establish-which-status-items-block-implementation) retains unresolved legacy policy questions.

### Pure Block decisions to finalize

Select the next bounded implementation scope from the [open work](#pure-block-open-and-deferred-work).
Resolve remaining declarations against their callers without reopening agreed names or behavior.
Replacement must preserve useful authoring, checking/listing, sync, rendering and CLI/MCP/editor
preview workflows. Retain graph construction, validation and cycle detection responsibilities;
retire only accepted concepts. Do not integrate a parser-only switch with broken callers,
compatibility aliases, legacy-cache reconstruction or withdrawn rendering.

### Parser and model contract checkpoint

Contracts are complete; runtime replacement is pending. Follow the [parser contract](docs/specs/stem-syntax.md#parser-contract),
[analysis/editing contracts](docs/specs/block-model.md#project-analysis) and
[supplied context](docs/specs/project-connections.md#supplied-evaluation-context).
The approved core inventory remains active below; it does not cover the still-unplanned adapter changes.
Paths are relative to `packages/core/`:

| Action                                                    | Files                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replace parser/model declarations and entry               | `src/parser/index.ts`, `src/types/ast.ts`, `src/types/block.ts`, `src/types/validation.ts`, `src/types/graph.ts`, `src/types/index.ts`, `src/index.ts`                                                                                    |
| Replace semantic analysis and graph callers               | `src/project/types.ts`, `src/project/index.ts`, `src/graph/builder.ts`, `src/graph/types.ts`, `src/graph/traverser.ts`, `src/validator/rules.ts`                                                                                          |
| Update existing acceptance coverage                       | `tests/parser/index.test.ts`, `tests/project/analyze.test.ts`, `tests/graph/builder.test.ts`, `tests/graph/traverser.test.ts`, `tests/validator/rules.test.ts`, `tests/portability/portability.test.ts`                                   |
| Remove after caller replacement                           | `src/parser/frontmatter.ts`, `src/parser/stem-plugin.ts`, `src/parser/two-pass.ts`, `src/types/view.ts`, `src/types/position.ts`, `tests/parser/frontmatter.test.ts`, `tests/parser/stem-plugin.test.ts`, `tests/parser/two-pass.test.ts` |
| Add scanner and selection modules with selection coverage | `src/parser/scanner.ts` (scanning/recovery behind the entry), `src/project/selection.ts` (shared ID/Tag lookup), `tests/project/selection.test.ts` (ambiguity, context and classification)                                                |

Reuse `src/renderer/index.ts` and `tests/renderer/index.test.ts` for composition. Scanner,
analysis/selection/graph, composition and coordinated callers are successive review stages of a
working replacement. Use specification examples and integration cases for deep traversal,
instance-aware identity/cycles, safe edits, diagnostic scope and rejection of stale editor results.
Run targeted checks per stage and the full workspace/artifact profile before integration is ready.

### Shared file-writer prerequisite

Complete in `cdd1389`. Reuse the writer under its [documented guarantees](docs/architecture.md#nodejs-adapters);
publication ownership and coordination remain separate work. [Verification evidence](docs/history/2026-10-pure-block-checkpoints.md#verification-evidence).

### Composition and adapter contract checkpoint

Contracts are complete in `72b3862`; runtime replacement remains pending. The
[composition specification](docs/specs/composition.md#composition-invocation) owns inputs, results,
budgets and [preview/output separation](docs/specs/composition.md#preview-and-output-adapters).
Approved caller direction to preserve in the concrete adapter plans:

| Caller                                        | Replacement                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Core `renderViewMarkdown()` and both branches | One `compose()` implementation.                                                                             |
| CLI `previewView()`                           | `previewSource()` with explicit Block/file selector and separate content/diagnostics.                       |
| CLI `renderView()` / `renderAll()`            | `renderOutputs()` under the [publication contract](docs/specs/composition.md#publication-result-reporting). |
| Editor `stem.previewToSide`                   | Retain command; compose active source and unsaved content without a frontmatter ID.                         |
| MCP View composition                          | Read-only explicit selection with structured completeness/diagnostics; protocol declaration still needed.   |
| Cached parsed Block/View reconstruction       | Fresh source analysis; remove `ZERO_POSITION` reconstruction.                                               |

Start core composition with explicit limits; measure representative large/deep inputs before
choosing shared defaults for user-facing callers. Keep ADR-0004's external-snapshot decoder
obligations; the new-model snapshot projection needs a separate plan.

### Durable project identity checkpoint

Complete in `225fdc8`, following documentation commit `32fbf66` and ADR-0010. The
[identity lifecycle](docs/specs/project-connections.md#project-identity-configuration) is now available
for later connection checks and producer-owned publication. [Verification evidence](docs/history/2026-10-pure-block-checkpoints.md#verification-evidence).

### Publication bookkeeping and coordination checkpoint

Private path, manifest and lock helpers are implemented; integration remains pending. The specification owns
[manifest encoding/validation](docs/specs/composition.md#manifest-encoding-and-validation),
[local coordination](docs/specs/composition.md#local-writer-coordination) and
[cleanup](docs/specs/composition.md#obsolete-output-cleanup). No new ADR or protected-file edit is required
for these refinements of ADR-0005.

Private helpers are complete in `7f06f08`; they use supplied protection paths and confirmed-write
records, with no command, public export or legacy-rendering bridge. The owner approved the two-file
publication contract checkpoint on 25 October 2026: [selection/commands](docs/specs/composition.md#publication-selection-and-commands),
[results](docs/specs/composition.md#publication-result-reporting) and
[explicit cleanup](docs/specs/composition.md#explicit-cleanup-command). Runtime integration is pending.
Next: bound its implementation file scope alongside the remaining preview/stdout/MCP declarations,
parser/composition replacement and measured limits; preserve working workflows until coordinated integration.

Local verification on 25 October 2026: the full workspace profile passed, including 829 workspace
tests (81 new helper tests) and 11 documentation tests. Coverage includes real competing processes,
root aliases, crash leftovers, failed persistence, ownership preservation and write-free reads.
Integration must still cover the specification's publication/cleanup cases and run-wide pruning
gate. Preserve current rendering until coordinated replacement supplies the complete workflow.

### Migration sequence

1. Finalize the remaining caller declarations, edit inventories, sync representation and publication scope listed below.
2. Implement scanner, analysis/selection/graph and composition in review stages; measure composition defaults before user-facing integration.
3. Coordinate adapter replacement with working file export, manifest tracking and then selective cleanup. Update current guides and generated declarations with runtime behavior; preserve authored View files under the source-transition contract.
4. Plan connection resolution separately under ADR-0007, resolving storage and transport before implementing those interfaces.

### D15. Dependency review

Deferred entirely from this migration. Reconsider when users need a signal that changed content may
require review of dependent authored material. Such a signal inserts no content, permits cycles and
does not itself make content incomplete or invalid. Missing targets are reported without rewriting
content. Required composition refresh remains governed by [D16](docs/specs/composition.md#d16-affected-results).

### D23. Schemas, structural validation, and templates

Tag-schema retirement and generic unknown-field validation are complete in `d775326` under the
[D23 transition contract](docs/specs/block-model.md#d23-schema-retirement-transition).
[Verification evidence](docs/history/2026-10-pure-block-checkpoints.md#verification-evidence) is historical.
Replacement schemas, structural validation and templates remain deferred; reconsider for a concrete
validation/authoring need, including their relationship to Tags. ADR-0004's external-snapshot contract remains binding.

### Pure Block open and deferred work

- **Adapter/evaluation contracts:** Remaining preview/stdout/MCP and other operation declarations and edit scopes, `getOrphanedBlocks()` disposition, position-free sync records and the new-model external-snapshot projection remain open. Initially use fresh parsing and no composition cache; later caching must satisfy the specification's invariance rules.
- **D24 defaults:** Measure work/output limits during composition implementation before integrating callers; [D24](docs/specs/composition.md#d24-resource-budgets) owns budget behavior.
- **Publication integration:** Private bookkeeping helpers are implemented and publication contracts are recorded; implementation scope, multi-root orchestration, output publication and cleanup remain open in the [bookkeeping checkpoint](#publication-bookkeeping-and-coordination-checkpoint).
- **D5 mechanics:** Connection IDs/generation, source-binding serialization, resolved-instance representation, Git transport syntax and remote-content storage remain open. Follow the [connection lifecycle](docs/specs/project-connections.md#connection-lifecycle) when selecting that slice; project identity is complete.
- **D5 deferred features:** Machine-local path overrides, nested-dependency overrides, connection-following mechanisms and background/time-based refresh remain deferred until a concrete workflow requires them.
- **Output extensions:** Per-target policy overrides, asset copying/link rewriting, partial-file generation and distributed coordination remain outside the initial contract; reconsider for demonstrated consumer needs.
- **D27 shorthand and formatter:** Defer shorthand until demonstrated demand and formatting until a concrete authoring need; neither blocks parsing, validation or export.
- Dependency review and replacement validation/templates remain tracked only in D15 and D23 above.

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
