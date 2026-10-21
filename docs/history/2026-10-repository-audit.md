# October 2026 repository documentation assessment

Historical, nonbinding evidence. Assessment date: 20 October 2026. Baseline: branch `feat/core-block-model`, HEAD `64ad029a57a977be9dbfc46f73e86d4a3254fb2b`. The assessment included the pre-existing unstaged axiom edit; it did not approve or alter it. No staged or nonignored untracked files existed at assessment start.

The owner approved the architecture, then the exact migration plan and ADR-0008. A separate one-time authorization covers only root AGENTS.md and docs/governance.md. Those authorizations do not accept ADR-0002/0005/0007, the four proposed product specifications, new runtime work, or publication.

Use [roadmap](../../roadmap.md) for active work, [governance](../governance.md) for lifecycle and [reference](../reference.md) for current behavior. Old task scopes and commands preserved below are evidence of their time, not current instructions.

## Assessment coverage

All 37 tracked Markdown files below were inventoried/read, together with CLI `docs/stem-api.d.ts`, tracked TSDoc metadata, manifests, public entries, relevant parser/renderer/graph/configuration/namespace/MCP/editor implementation and tests, scripts, CI/release and packaging configuration.

```text
.agents/skills/stem-docs/skill.md
AGENTS.md
CONTRIBUTING.md
README.md
docs/architecture.md
docs/axioms.md
docs/decisions/0000-template.md
docs/decisions/0001-extract-core-package.md
docs/decisions/0002-frontmatter-yaml-core-schema.md
docs/decisions/0003-clarify-axiom-4.md
docs/decisions/0004-core-schema-and-snapshot-decoders.md
docs/decisions/0005-pure-block-model.md
docs/decisions/0006-documentation-ownership.md
docs/decisions/0007-independent-project-connections.md
docs/governance.md
docs/rules.md
docs/specs/block-model.md
docs/specs/composition.md
docs/specs/project-connections.md
docs/specs/stem-syntax.md
docs/status.md
install-npm/blocks/smoke-block.md
install-npm/views/smoke-view.md
packages/cli/AGENTS.md
packages/cli/CHANGELOG.md
packages/cli/README.md
packages/cli/docs/decisions.md
packages/cli/docs/prd.md
packages/cli/spike/test-input.md
packages/core/AGENTS.md
packages/core/CHANGELOG.md
packages/core/README.md
packages/vscode-stem/AGENTS.md
packages/vscode-stem/CHANGELOG.md
packages/vscode-stem/CONTRIBUTING.md
packages/vscode-stem/README.md
roadmap.md
```

Classification: six maintained overview/package/contribution guides; eight governance/agent/skill files; three architecture/work-state documents; one ADR template and seven decisions; four proposed specifications; two legacy CLI design documents; three generated package changelogs; three intentional Markdown fixtures.

The three fixtures are `packages/cli/spike/test-input.md`, `install-npm/blocks/smoke-block.md`, and `install-npm/views/smoke-view.md`. Parser inputs are not outdated guidance merely because they contain legacy/invalid syntax. The broader install-npm consumer residue still needs a separate value/removal decision.

Six ignored local documents were inspected as provisional/historical evidence: root `prd.md` and `migrations/00_overview.md`, `01_specification.md`, `02_master_plan.md`, `03_phase_checklists.md`, `04_execution_log.md`. They remain untouched. The root PRD proposes unaccepted packages/DSL; a local migration log claims removal of structures still present in core types. Neither grants accepted scope. `.agents/rules` had no additional files.

Excluded from maintained documentation: dependencies, vendored content, Git internals, caches, temporary workspaces, rendered/build/coverage outputs and packaged artifacts. Licenses remain distribution/legal artifacts. Generated declarations and release records have separate owners.

## Assessment checks and limits

Before migration, documentation budgets passed for 15 governed files and `git diff --check` passed. An in-memory Markdown scan checked 179 local links/heading targets without missing targets; its slug approximation was not a GitHub rendering certification. All 32 Pure Block D-labels remained present. Core README execution succeeded against current source.

Read-only rendering probes confirmed scoped duplicate-tag joining, tag-only whole-block selection, and an unexpanded external reference without supplied prose. Relevant source, tests, command/MCP registration, settings and manifests supplied supporting evidence.

The assessment did not run a fresh full build/test profile, regenerate tracked declarations, install package candidates, exercise real editor hosts, verify registry/Marketplace delivery, recover all old temporary artifacts, or fetch every one of the 79 external Markdown links. Prior test passes are historical, not new results. It was not a release certification or security audit.

## Assessment corrections

File/line references in this table identify the **pre-migration baseline**, not line positions in rewritten guides.

| Priority | Baseline evidence / finding                                                                                                                 | Disposition                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| P1       | ADR-0002:3 proposed versus rules:11 requiring its policy and the legacy journal's supersession claim                                        | Keep proposed; owner decision under R00; qualify journal authority                         |
| P1       | CLI PRD:147–160 promises external and tag-match composition; renderer:125 joins scoped matches, :129 selects whole blocks without a section | Historical PRD; current reference describes observed limits; product decisions remain open |
| P1       | Roadmap:139–140 marks R01/R02 done, detailed records :214/:227 retain host checks                                                           | One work-state owner; preserve outstanding host acceptance                                 |
| P2       | No maintained shared current language reference; four specs proposed; parameter references already tested                                   | Add descriptive reference, keep interface tasks in package guides                          |
| P2       | Status:7 array/join allegation contradicted by renderer and regression probe                                                                | Close that allegation; distinguish the observed tag-only limitation                        |
| P2       | Roadmap:389 instruction corrections already reflected in current AGENTS; :290 lock refresh overtaken by js-yaml 3.15.2                      | Remove obsolete active tasks; keep dated evidence, no broader risk-resolution claim        |
| P2       | Publication-pending wording versus source versions/tags/changelogs                                                                          | Separate source, candidate, host and distribution evidence                                 |
| P2       | Roadmap 402 lines/~80 KB mixes work, procedures, contracts and execution history                                                            | Work in roadmap; procedures in CONTRIBUTING; evidence here                                 |
| P2       | Roadmap D23:74 specifies preservation/errors                                                                                                | Move behavior to proposed model transition section; retain execution/deferral              |
| P2       | Architecture:48 nonexistent preview-loader.ts                                                                                               | Correct code map to src/project.ts                                                         |
| P2       | Governance:39, ADR-0006:19–21, rules:10 require excessive ADR creation                                                                      | ADR-0008 plus specifically authorized governance/instruction amendments                    |
| P2       | Journal:174 always-fetch claim; PRD:293 complete-graph contentSha claim; roadmap:284 stem_render tool claim                                 | Dated corrections; current fetch behavior, metadata hash, composed-view resource           |
| P2       | CI checks size but not links, reference freshness or examples                                                                               | Add bounded deterministic documentation checks                                             |
| P3       | Tracked package-root TSDoc metadata is obsolete; current extractor resolves ignored dist output                                             | Remove stale root output; retain generator ownership                                       |
| P3       | install-npm depends on absent local tarballs                                                                                                | Keep pending separate residue/example decision; preserve intentional fixtures              |

Current source paths supporting these observations include [renderer](../../packages/core/src/renderer/index.ts), [frontmatter parser](../../packages/core/src/parser/frontmatter.ts), [fetch](../../packages/cli/src/runtime/operations/fetch.ts), [publish](../../packages/cli/src/runtime/operations/publish.ts), [MCP server](../../packages/cli/src/mcp/server.ts), [extension entry](../../packages/vscode-stem/extension.js), and [core types](../../packages/core/src/types/block.ts). Their contents may evolve after this baseline.

## Architecture research and owner choices

Owner assumptions: owner-led maintenance, repository/package publishing, one roadmap. Three approaches were compared: README-only guidance is too small for shared semantics across three interfaces; selective reader-oriented guidance/reference plus scoped specs/ADRs fits current capacity; a portal/full architecture template/separate RFC process adds unjustified maintenance.

The recommendation borrows incremental reader distinctions from [Diátaxis](https://diataxis.fr/start-here/), significance thresholds from [arc42](https://docs.arc42.org/section-9/), and only useful diagrams from [C4](https://c4model.com/diagrams). Maintained examples: [mdBook navigation](https://raw.githubusercontent.com/rust-lang/mdBook/master/guide/src/SUMMARY.md), [rust-analyzer architecture](https://rust-analyzer.github.io/book/contributing/architecture.html), and [Rust RFC substantial-change boundaries](https://github.com/rust-lang/rfcs/blob/main/README.md). Their scale/process is not a Stem requirement.

ADR policy draws on [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions), [AWS lifecycle guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html), and [MADR](https://adr.github.io/madr/). Stable accepted history plus a current-applicability map reduces cognitive load without deleting rationale. Physical ADR archiving/deletion loses discoverability and ordinary links; retaining every unaccepted scratch draft is also unnecessary. The exact draft-removal/review rules are Stem's approved judgment.

Community files were assessed individually. Support/contribution expectations fit CONTRIBUTING now. A security file awaits a monitored private route; [GitHub's private-reporting mechanism](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository) was researched but repository enablement was not verified. Deferring a standalone conduct policy is a capacity judgment; [conduct guidance](https://opensource.guide/code-of-conduct/) emphasizes reporting/enforcement responsibilities. Adoption triggers live in roadmap.

## Migration traceability

| Source at baseline                                                | Retained/moved/merged/rewritten/removed destination                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Root/package guides and extension contribution guide              | Retain reader tasks; route shared semantics to reference and common verification to CONTRIBUTING                        |
| CLI PRD, all sections                                             | Complete [historical copy](legacy-cli-prd.md); verified semantics rewritten in reference; original path/anchors forward |
| CLI decision journal, all sections                                | Complete [historical copy](legacy-cli-decisions.md); dated corrections; original path/anchors forward                   |
| Roadmap:1–32 product phases                                       | Completed milestones preserved below; unfinished ideas retained as roadmap candidates                                   |
| Roadmap:34–89 Pure Block planning                                 | Retained as proposed planning; prior cleanup evidence below; D23 behavior moved to model specification                  |
| Roadmap:91–150 audit/findings/order                               | Preserved below; active task states reconciled in roadmap without duplicate status table                                |
| Roadmap:152–199 common procedures                                 | Merged into CONTRIBUTING; historical original preserved below                                                           |
| Roadmap:201–366 R00–R10                                           | Full records below; only unresolved work remains active; completed task anchors forward here                            |
| Roadmap:367–384 D01–D12/K01                                       | Full dispositions below; genuine deferrals/triggers remain active, completed/rejected records stay historical           |
| Roadmap:385–402 decisions/workflow                                | Remaining owner choices retained; stale corrections closed; reusable workflow merged into CONTRIBUTING                  |
| Status:1–42                                                       | Full original below; open work merged into roadmap, procedures into CONTRIBUTING; original headings forward             |
| Architecture                                                      | Retain boundaries/flows; correct path; add glossary/current applicability/history navigation                            |
| Four proposed specs                                               | Preserve working agreements; relocate D23 behavior; add illustrative examples without new semantics                     |
| ADR-0001/0002/0003/0004/0005/0007                                 | Unchanged; no product acceptance or schema retirement                                                                   |
| ADR-0006                                                          | Accepted body unchanged; status alone records precise partial supersession by ADR-0008                                  |
| ADR template; rules; governance; root AGENTS                      | Updated under ADR-0008; protected edits covered only by the separate one-time authorization                             |
| Generated declarations / TSDoc metadata                           | Verify generation; remove only obsolete tracked root metadata; no handwritten signatures                                |
| Changelogs, licenses, fixture Markdown and ignored local material | Retained untouched                                                                                                      |

Pure Block ownership: model D1–D4/D4a–D4c/D6–D10/D22/D29 and D23 transition; syntax D11 recognition/D26–D28; composition D11 evaluation/D12–D14/D16–D21/D24–D25; connections D5; roadmap D15 and D23 execution/deferral. Remediation D01–D12 are a different collection. The preservation of 32 labels is a traceability check, not proof of optimal organization or complete behavior.

## Migration verification (20 October 2026)

The approved documentation migration was implemented in the working tree on Windows, based on the same HEAD above. The owner separately authorized root AGENTS.md and docs/governance.md edits as a one-time exception. The pre-existing axioms diff was preserved; no files were staged, committed or published. Product decisions and their four specifications remain proposed, ADR-0004 remains accepted in full, and ADR-0006's accepted body is unchanged apart from its status identifying the precise partial supersession.

Fresh implementation checks, distinct from the earlier read-only assessment:

- Build, typecheck and lint passed. Existing tests passed: core 288, CLI 267 and extension 160 (715 total); the 11 new documentation-check tests passed.
- Dependency boundaries passed (167 modules, 565 dependencies), and the built-CLI smoke check passed. Documentation budgets passed for seven bootstrap/governance files after the approved removal of the universal ADR quota; whitespace checks passed.
- Documentation verification covered all 42 repository Markdown files, local/repository links and all 32 Pure Block labels at their canonical owners. Fixture navigation is deliberately excluded. All 89 original heading targets across roadmap, status, PRD and journal remain available at their old paths.
- The core README and selected reference examples executed against the built public core entry. This caught and corrected the reference's selection argument spelling (`section=details`, not `section:details`) and checked actual whitespace behavior.
- Regenerating the CLI API rollup into a temporary directory matched the tracked declaration; no signature file change was required. API Extractor emitted a TypeScript-version notice (bundled 5.9.3 versus project 6.0.3), without failing extraction or comparison.
- Complete historical PRD/journal bodies match the original tracked text, apart from newline normalization and their added provenance/correction sections. Existing ADR-0001/0002/0003/0004/0005/0007 contents, package instructions, fixtures, changelogs and ignored local material remain untouched.
- Local core/CLI tarballs passed dependency-specifier checks; core also passed strict publint and attw's ESM-only profile. Their packaged READMEs match source. The VSIX contains the seven expected entries, including the bundled extension, and absolute shared-reference/contribution links. No runtime source changed.

Candidate artifacts were created outside the repository in an owned temporary directory named `stem-docs-migration-aa248aa07a7a4a21a669c092f80bc8fc`. These hashes identify local verification artifacts, not published releases; temporary retention is not guaranteed.

| Artifact                 | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `stemdev-core-0.1.0.tgz` | `e07cf359656551bdc3e81bf5b4da1912064e6d0445c376739d18c9912066f212` |
| `stemdev-cli-0.3.1.tgz`  | `98347529226621c12b158fd6d96f4830077bd51e49e9565c0f654dfa1e71c371` |
| `stem-docs.vsix`         | `e864a8b80f57b3adca64b3bfa58c8a1c45e48444a0e0610d21d2cc07ce150044` |

This verification does not certify real VS Code/Cursor host acceptance, a newly installed clean consumer, registry/Marketplace delivery, external-link availability, browser rendering, or current security exposure. Package README links target repository main and become available there only when this change is merged; nothing was published to make those links live. [R01/R02](../../roadmap.md#repository-remediation) and [R10](../../roadmap.md#r10-verify-an-authorized-release-delivers-selected-fixes) retain their outstanding acceptance/distribution work. ADR-0002, the existing axiom edit, product proposal acceptance and the private security-reporting route remain separate owner decisions.

## Preserved roadmap before migration

The complete pre-migration roadmap follows. Relative Markdown links have been rebased for this location; links to its former status/roadmap fragments resolve within this preserved record. Historical claims, approvals, task states and procedures retain their original wording.

# Stem Roadmap

This document outlines the post-MVP roadmap for Stem, starting with foundational core updates and moving towards major AI and web integrations.

The phase entries retain existing product work and future ideas; their syntax sketches do not define the proposed Pure Block grammar. The [Pure Block migration](#pure-block-migration) separately tracks that draft design and its open work.

## Phase 1: Foundational Core Updates

These are internal architecture improvements to prepare the codebase for complex integrations without breaking existing functionality.

- [x] **Namespace Syntax:** Update ID validation to accept namespaces (e.g., `@stem[block:my-repo:auth-flow]`). This is the necessary groundwork for cross-project references.
- [x] **Cross-Project References:** Implement `stem publish-graph` and `stem fetch-namespaces` CLI commands to safely map, cache, and validate structural snapshots across different repositories.
- [x] **Machine-Readable CLI Output:** Add a `--json` flag to commands like `stem check` and `stem list` to output structured JSON arrays, enabling trivial CI/CD integration.

## Phase 2: Major Integrations

These features fulfill Stem's core mission: bridging the gap between active code and AI coding agents.

- [x] **MCP Server (Model Context Protocol):** `stem mcp` provides stdio tools for listing blocks/views and checking references, plus raw-block and composed-view resources. See the [CLI MCP guide](../../packages/cli/README.md#mcp-server).
- [ ] **Live Code References:** Implement the `@stem[code:path/to/file.ts#L10-L20]` directive, allowing blocks to transclude real source code that updates automatically, solving documentation staleness.

## Phase 3: Publishing and User Interface

Features focused on human readability and distribution.

- [ ] **HTML Export & Publishing:** Add an HTML pipeline to generate static websites from the Markdown, and create a GitHub Action for automated publishing.
- [ ] **Web UI:** Build a local server (`stem serve`) to visually browse the connection graph (e.g., using D3.js or React Flow) and read views in a browser.

## Phase 4: Advanced Graph Features

- [ ] **Localization:** Support for fallback view/block resolution (e.g., falling back to `en` if `es` is missing).
- [ ] **External Sources:** Pulling OpenAPI specs or GraphQL schemas as virtual blocks.

## Pure Block migration

Status: design proposed; implementation and product acceptance remain deferred.
The owner approved the documentation restructuring and the one-time governance-editing exception on 19 October 2026;
[ADR-0006](../decisions/0006-documentation-ownership.md) accepts only documentation organization.
Use the [design navigation and D-label map](../architecture.md#proposed-pure-block-design) for the contracts.
D-labels in this section belong to the Pure Block proposal; the older remediation register below has separate identifiers.

### Documentation and decision review

- Documentation restructuring: ADR-0005 condensed, ADR-0007 proposed, four draft specifications extracted, and existing navigation updated.
- Documentation validation: budgets and whitespace checks passed; 171 local links/anchors checked, all 32 D-labels retained, and 100 original decision paragraphs reconciled across their new owners. ADRs 0001–0004, axioms, rules, and the existing Git index remain unchanged by this cleanup.
- Product review remains open: review ADR-0005 and ADR-0007 with their specifications before acceptance. Preserve working agreements without presenting them as implemented.
- ADR-0000 is the retained template, not a decision. Its status guidance now supports partial supersession.
- ADR-0001 remains accepted: package extraction, portability, and public-entry boundaries still apply.
- ADR-0002 remains proposed despite its implementation and references in binding rules and core instructions. Existing source and tests reflect its principal policy choices; recommend a separate owner acceptance review under [R00](#r00-establish-which-status-items-block-implementation), not automatic acceptance during cleanup.
- ADR-0003 remains accepted: its completed axiom clarification still distinguishes the model from the package.
- ADR-0004 remains accepted: its schema and snapshot requirements apply until an accepted replacement identifies the exact superseded scope. ADR-0005 proposes only partial supersession.
- Retain existing ADR bodies and numbering; no older record is deleted or marked stale.
- Community documentation is separate follow-up scope: assess contribution/support/security/conduct guidance before proposing files or maintainer commitments; this cleanup adds none.

### Migration sequence

1. Resolve the [open design work](#pure-block-open-and-deferred-work) needed for the selected implementation slice and explicitly accept its governing product decisions and contracts.
2. At ADR-0005 acceptance, update only the affected Tag-schema rule and ADR-0004 status to identify the replaced scope; preserve external-snapshot requirements and core/I/O boundaries.
3. Prepare a bounded implementation plan for core model, syntax, composition, and public API changes, using the specifications as acceptance criteria.
4. Plan project-connection resolution and lifecycle across core and adapters under ADR-0007; resolve storage and transport mechanics before implementing those interfaces.
5. Apply the schema retirement below alongside the migration, then update CLI/editor behavior and released-user guidance with targeted validation. Implementation order and files require the subsequent code plan.

### D15. Dependency review

Defer implementation and detailed design of the dependency review feature entirely from this migration. Preserve its intent: a changed target indicates that dependent authored content may need review. Deferred feature notes, not migration requirements: dependency review inserts no content, allows cycles, and reports missing targets without itself making content incomplete; a review signal does not rewrite content or automatically make it invalid or incomplete.

Required composition refresh is specified in [D16](../specs/composition.md#d16-affected-results).

### D23. Schemas, structural validation, and templates

Remove the existing Tag-schema feature as part of the Pure Block migration: its validation, schema loading and configuration, initialization templates, and feature-specific public types/decoders.
The retirement choice and its rationale belong to [ADR-0005](../decisions/0005-pure-block-model.md#rejected).

Preserve user-authored schema files as ordinary files; do not automatically delete or convert them. Configuration still requesting the retired feature reports an unsupported-setting error with migration guidance rather than silently pretending the checks ran. This removal does not remove the grammar, identity, reference, or composition validation required by the proposed specifications.

Defer replacement schemas, structural validation design, and template features; their future relationship to Tags remains open.
Partial supersession and rule changes occur only on formal product acceptance as specified in
[ADR-0005](../decisions/0005-pure-block-model.md#consequences); this roadmap authorizes no code changes.

### Pure Block open and deferred work

- **D5 mechanics:** Concrete project/connection ID formats and generation mechanisms, source-binding field names and serialization, resolved-instance representation, supported Git transport syntax, and remote-content storage layout remain open. Command/UI details and persistence mechanisms must implement the [connection lifecycle contract](../specs/project-connections.md#connection-lifecycle); machine-specific local path overrides remain deferred. Recording the resolved dependency graph does not require deciding on a new lockfile or configuration syntax.
- **D5 dependency policies:** User-configurable overrides of nested dependencies and explicit mechanisms for one connection to follow another remain deferred.
- **D5 refresh scheduling:** Background polling and time-based refresh intervals remain deferred.
- **D24 defaults:** Numeric work/output budget defaults await measurement; the required behavior is in [D24](../specs/composition.md#d24-resource-budgets).
- **D27 shorthand:** Single-Tag shorthand is deferred pending demonstrated user need.
- **Evaluation mechanics:** Cache format and algorithm, detailed result contracts, and ID generation mechanics remain deferred.
- **Formatter:** An optional future feature; detailed design is deferred, and parsing, validation, and export do not require it.
- Dependency review and replacement validation/templates remain owned by D15 and D23 above.

## Repository remediation

Prepared 9 October 2026 from the repository audit dated 8 October 2026. Initial approval covered recording this backlog only; later owner authorizations and implementation evidence are recorded in individual tasks. No release, registry change, or external issue is authorized by this backlog. Detailed task definitions, task status, and validation evidence belong here; [current status](../status.md) links here. R06 aligns the implemented MCP product-roadmap item above.

Follow [repository instructions](../../AGENTS.md), [governance](../governance.md), and the [stem-docs skill](../../.agents/skills/stem-docs/skill.md). This backlog preserves the Block and Tag model and proposes no new package or primitive.

### Audit baseline

- Planning baseline: clean checkout at `a4e638666794214ed6ed676b15a851a485fcfa8d`. Stable release source: `ea578b4cb011de57d41054c85daf3f6335891a60`, corresponding to core 0.1.0, CLI 0.3.0, and extension 0.4.0. HEAD differs by a registry-verifier timeout change, not the fixes below.
- Published npm tarball integrity/provenance and release-source identity were checked. Built JavaScript, declarations, and extension bundle matched release source; README/license differences were line endings. The extension evidence is the [0.4.0 release VSIX](https://github.com/stemdev-hub/cli/releases/tag/vscode-stem-v0.4.0); Marketplace publication was not verified.
- The audit passed Windows checks with Node 26.7 and pnpm 11.2.2: build, typecheck, lint, 633 tests in 42 suites, dependency-cruiser (168 modules / 559 dependencies), documentation budgets (12 files), built-CLI smoke, clean npm/pnpm consumers, core imports/types/browser-worker checks, and VSIX inspection. `stem --version` failed; production dependency advisories remained. Linux Node 22/24/26 checks were supported by [CI run 37783766792](https://github.com/stemdev-hub/cli/actions/runs/37783766792).
- Coverage limits: 193 tracked files inventoried and 134 source files inspected by AST/import analysis; not every line was reviewed. No real extension-host or macOS validation, exhaustive browser certification, cyclic-link or native POSIX directory-symlink parity. Current canary artifacts were inspected but not clean-consumer tested. Passing audit checks are baseline evidence, not validation of future remediation.
- No P0 finding was established. Existing package placement and public identities remain appropriate. A source fix does not repair an already published version.

### Finding disposition map

IDs below normalize the original report's numbered findings; subdivisions separate root causes, not extra severity.

| Audit ID / original finding                                            | Disposition                                                               | Task or register                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| A01 / 1: preview identifies YAML using a regex                         | Confirmed defect                                                          | R01                                      |
| A02 / 2: VS Code receives Cursor-shaped MCP configuration              | Confirmed defect                                                          | R02                                      |
| A03a / 3: unsupported detection probe and ignored CLI setting          | Confirmed defect                                                          | R03                                      |
| A03b / 3: Windows executable/shim invocation                           | Needs verification within the discovery repair                            | R03                                      |
| A03c / 3: no CLI version flag                                          | Maintainability improvement; no documented flag promise was established   | R09, deferred; not a prerequisite of R03 |
| A04a / 4: CLI production dependency ownership                          | Maintainability improvement                                               | R04                                      |
| A04b / 4: advisory-bearing dependency chains                           | Exposure confirmed; reachability and remedy need verification             | R05                                      |
| A05a / 5: obsolete root guidance                                       | Maintainability improvement                                               | R06                                      |
| A05b / 5: obsolete extension integration guidance                      | Coupled documentation correction                                          | R01 and R03, respective sections         |
| A05c / 5: stale generated CLI API reference                            | Maintainability improvement                                               | R07                                      |
| A06a / 6: protected instructions describe extraction as planned        | Confirmed documentation drift; human-owned correction                     | R00                                      |
| A06b / 6: ADR-0002 remains proposed while rules refer to it            | Governance decision needed                                                | R00                                      |
| A07a / 7: tracked install-npm consumer residue                         | Optional; value as an example not settled                                 | D01                                      |
| A07b / 7: missing repository.directory metadata                        | Optional metadata improvement                                             | D02                                      |
| A07c / 7: packaged extension contribution link resolves to root guide  | Confirmed documentation defect                                            | R08                                      |
| A07d / 7: core discovery/package README                                | Owner-authorized README and discovery guidance completed                  | R06 and D03                              |
| A08 / compatibility assessment: removed CLI domain/config type exports | Explain the existing release boundary; no compatibility wrappers proposed | R06 and R07                              |
| A09 / release plan: source completion versus consumer delivery         | Track artifact verification separately                                    | R10                                      |

Other suggestions and keep decisions are explicitly recorded in the [deferred register](#deferred-and-rejected-suggestions). Duplicate documentation findings are included with their owning behavior task.

### Execution order

Priority expresses impact, not scheduling: P0 requires concrete severe immediate impact; P1 is a significant consumer/correctness/release problem; P2 is meaningful maintenance/workflow work; P3 is optional consistency or cosmetic work.

| Position           | Task                                           | Priority | Prerequisites                                                            | Size   | Status                                        |
| ------------------ | ---------------------------------------------- | -------- | ------------------------------------------------------------------------ | ------ | --------------------------------------------- |
| 1                  | R00: establish implementation gate disposition | P2       | Human decisions to complete                                              | Medium | Proposed                                      |
| 2                  | R01: core semantics for preview identification | P1       | Owner waived extension-remediation gate                                  | Small  | Done                                          |
| 3                  | R02: host-specific MCP configuration           | P1       | Owner waived extension-remediation gate                                  | Medium | Done                                          |
| 4                  | R03: configured/installed CLI discovery        | P2       | Owner waived extension-remediation gate; R02 source in place             | Medium | Done; candidate verified, publication pending |
| 5                  | R08: packaged contribution link                | P2       | No technical prerequisite; preferably after guide corrections in R01/R03 | Small  | Done                                          |
| Release checkpoint | R10: selected fixes reach consumers            | P1       | Only the selected source tasks and explicit release approval             | Medium | Candidate verified; registry publish pending  |
| 6                  | R04: CLI dependency ownership                  | P2       | R00 disposition                                                          | Small  | Done                                          |
| 7                  | R05: advisory investigation                    | P2       | None; can run earlier without waiting for R04                            | Medium | Done                                          |
| 8                  | R06: repository guidance                       | P2       | Owner authorized documentary scope and D03                               | Medium | Done; candidate verified                      |
| 9                  | R07: generated API reference                   | P2       | None; use the current approved source baseline                           | Small  | Done                                          |
| Optional           | R09: CLI version reporting                     | P2       | Explicit selection and R00 disposition; never required by R03            | Small  | Deferred                                      |

R05-R07 read-only investigation or documentation preparation can proceed independently of optional cleanup. R04-R09 need not delay a release of R01-R03. R10 can recur for separately approved extension and CLI releases; it is not a demand to release every task together.

### Shared task requirements and validation

Every task includes updating its record here and any necessary links or unresolved-item changes in `docs/status.md`. Behavior documentation belongs in the same task as the behavior change. Those two documentation files are implicit in each allowlist below. All other files are excluded unless named; any necessary expansion must be proposed before editing. No task authorizes protected-file edits, new documents, package identities, packages, or primitives.

Use the project's pinned pnpm 11.2.2 and existing lockfile. Generate build/pack/test artifacts in an isolated temporary copy where practical. Angle-bracket arguments below are placeholders: resolve and record exact paths/versions before execution. They are not literal shell commands to paste unchanged.

**Code profile**, from the repository root after inspecting lifecycle scripts:

```sh
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm depcruise
pnpm --filter @stemdev/cli smoke:built-cli
node scripts/check-doc-budgets.mjs
git diff --check
```

For extension tasks, additionally build a VSIX, inspect its entry point/assets and exclusions, and perform the task's host checks:

```sh
pnpm --filter vscode-stem exec vsce package --no-dependencies --out <absolute-temporary-vsix-path>
```

There is no established automated real-host validation command. Record the editor version and manual procedure; mocked VS Code tests alone do not prove host integration.

**Documentation profile**:

```sh
node scripts/check-doc-budgets.mjs
git diff --check
git diff --name-only
git diff -- roadmap.md docs/status.md
```

Review other task-specific documentation diffs and relative paths/anchors as applicable. No repository link-check command was established. Documentation-only backlog recording does not require code builds or tests.

**CLI packaging profile**, in isolation, with clean consumer directories outside the workspace:

```sh
pnpm --filter @stemdev/cli pack --pack-destination <absolute-temporary-directory>
node scripts/verify-release-tarball.mjs <cli-tarball-path>
```

Install the selected exact tarball/version with npm and pnpm, confirm the intended core dependency resolves without workspace links or source aliases, and run executable resolution, `stem --help`, and harmless `stem init` smoke. Record the exact install command and resolved versions at execution.

Task statuses are proposed, ready, in progress, blocked, done, or deferred. Ready requires approved scope and satisfied prerequisites. Done requires passing acceptance criteria, not just changed files. Track distribution separately as not applicable, pending, candidate verified, or published verified, with exact versions/artifacts. Initially no remediation validation has run. Each completed task record must include baseline SHA, actual file scope, exact commands/results, platform, artifact identity, and remaining limits.

### R00: Establish which status items block implementation

- **Classification / priority / state:** Needs verification; P2 because an ambiguous implementation gate can block valid work or permit an unsupported change. Proposed; distribution not applicable. Medium; policy ambiguity is the main risk.
- **Evidence:** A06a/A06b; the three [open spec claims](#open-spec-bugs-resolve-before-further-implementation), proposed [ADR-0002](../decisions/0002-frontmatter-yaml-core-schema.md), and references in `docs/rules.md`. Renderer handling and existing duplicate-fragment tests mean historical status wording alone is insufficient evidence that all claims remain defects.
- **Outcome / scope:** Read the relevant renderer, graph, parser, and tests; write only this backlog and status. Classify each historical claim as reproduced, disproved, or unresolved policy, with evidence. Obtain the owner's disposition of the implementation gate and ADR status. Propose human-owned root/CLI/extension AGENTS corrections in chat; never apply them.
- **Exclusions:** No renderer/spec fix, tags-to-labels rename, rule change, ADR acceptance, or protected-file edit. This task must not silently reinterpret policy based on passing tests.
- **Dependencies / position:** First. Human policy decisions are required to complete it; recording the backlog does not require resolving those decisions.
- **Acceptance:** All three claims have an evidence-backed disposition; unresolved choices remain explicit; permission for subsequent implementation is clear; protected-instruction changes are assigned to the owner.
- **Validation:** Documentation profile. If reproduction is necessary, in isolation run `pnpm --filter @stemdev/core exec vitest run tests/renderer/index.test.ts tests/graph/builder.test.ts` and inspect relevant expectations. A test result does not accept an ADR.
- **Compatibility / rollback:** No runtime or publication change. Revert documentation edits if inaccurate, while preserving the record of genuine owner decisions.

### R01: Use core semantics when opening a view preview

- **Classification / priority / state:** Confirmed defect; P1 because valid core-supported views fail editor selection. In progress: implementation, automated validation and Cursor host API checks passed; manual host acceptance remains open. Distribution pending. Small; moderate error-handling risk. On 10 October 2026 the owner deferred the historical core spec claims to the Pure Block Model migration, waived R00 for extension remediation, and approved the seven-file R01 plan; remaining R00 policy decisions stay open.
- **Evidence:** A01/A05b; baseline `a62c18a824e856ac24f74bf1917617e4a9f0a803` selects previews with `getFrontmatterId` in `packages/vscode-stem/extension.js`. Audit fixtures accepted by core but missed/misread by the regex include a quoted `"id"` key, a `---yaml` opener, and `id: "api\u002dview"` (decoded by core but treated literally by the helper). The audit also identified the defect in release VSIX 0.4.0; that published artifact was not reverified here.
- **Scope / change:** Seven files: `packages/vscode-stem/extension.js`, `tests/preview.test.ts`, `tests/vscode-stem.test.ts`, preview-related sections of its `README.md` and `CONTRIBUTING.md`, this R01 record, and `docs/status.md`. Paths after the extension entry through the guides are relative to `packages/vscode-stem/`. The command imports public core `parseViewFile`, uses the active buffer's decoded ID, and reports `INVALID_FRONTMATTER` before tracking/opening; body-reference errors retain the existing preview error display. Removed the regex helper and corrected bundled-core guidance. `src/project.ts` needed no change.
- **Exclusions:** No core YAML change, new public export, MCP change, or general helper cleanup.
- **Dependencies / position:** Owner gate waiver and plan approval recorded above. R02 sequencing only prevents overlapping edits; its existing implementation is preserved.
- **Acceptance:** Each fixture opens the intended view; ordinary IDs still work; invalid metadata produces useful feedback; unsaved buffers, trust checks, and cancellation retain behavior. Tests exercise the command path, not just an isolated parser call.
- **Validation (10 October 2026):** Windows x64 / Node 26.7.0 / pinned pnpm 11.2.2. Isolated tracked-file copy at `C:\Users\Asus\AppData\Local\Temp\stem-r01-6e6e786467e9429c96391de681469193`, with existing dependency junctions and no install; set `$env:pnpm_config_verify_deps_before_run = 'false'` only for temporary-copy commands. Passed `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (694 tests / 42 suites: core 288, CLI 267, extension 139), `pnpm depcruise` (167 modules / 563 dependencies), and `pnpm --filter @stemdev/cli smoke:built-cli`. Focused `pnpm --filter vscode-stem exec vitest run tests/preview.test.ts tests/vscode-stem.test.ts` passed 102 tests. In the real Git checkout, `node scripts/check-doc-budgets.mjs` passed 12 files and `git diff --check` passed; scope/protected-file review passed. The first build rejected a CommonJS core import; the final bundled dynamic import and all subsequent checks passed with zero errors.
- **Candidate inspection:** `pnpm --filter vscode-stem exec vsce package --no-dependencies --out C:\Users\Asus\AppData\Local\Temp\stem-r01-6e6e786467e9429c96391de681469193\stem-r01-candidate.vsix` passed. Unpublished 0.4.0 candidate SHA-256: `A33074832536A807C99FA3BDDE7F2D82362F945EBCA3FF783A7045F1ABC1B6B7`; source identity is the baseline above plus this uncommitted seven-file change. Seven ZIP entries; `./dist/extension.js` equals the tested bundle, core is bundled, source/tests/maps/dependencies are excluded, and engine remains `^1.101.0`. VSCE emitted npm environment and bundle-size notices; no packaging error. No release or publication was performed.
- **Host evidence / remaining acceptance:** Extracted candidate loaded via a temporary `host-validation/harness.cjs` using `--extensionDevelopmentPath`, `--extensionTestsPath`, `--new-window`, separate `--user-data-dir` / `--extensions-dir`, and disposable workspace fixtures under the isolated copy. Cursor 2.3.41 (API 1.105.1, trusted) invoked the real `stem.previewToSide` command and native Markdown command: ordinary, quoted-key/ID, YAML-opener and Unicode-escape cases produced the expected virtual document contents from unsaved views/blocks; unsaved block auto-refresh passed; malformed YAML, missing ID and numeric ID opened no new preview. Disk contents remained unchanged. VS Code 1.126.0 refused preview in its untrusted fixture. Reports/logs remain under `host-validation`; both test hosts exited. Host logs included Cursor native-module, missing optional schema directory and `ENOPRO` diagnostics, plus a VS Code mutex diagnostic, so this is API/document evidence, not proof of visual Markdown rendering or notification presentation. Native UI control is unavailable; complete the [manual preview checklist](../../packages/vscode-stem/CONTRIBUTING.md#manual-test-checklist), including trusted VS Code preview, before marking R01 done. No trust bypass, MCP configuration edit, or publication occurred.
- **Compatibility / rollback:** Existing core/API/CLI identities unchanged. Consumers need a new extension release through R10. Revert the scoped source/tests/docs together; a published VSIX needs a corrective version rather than overwriting the old artifact.

### R02: Serialize MCP configuration separately for VS Code and Cursor

- **Classification / priority / state:** Confirmed serialization-contract defect; P1. Implemented with automated validation passed; real-host acceptance and distribution pending. Medium; user-configuration preservation is the main risk. On 10 October 2026 the repository owner approved this six-file implementation and waived the R00 core spec gate for extension remediation tasks; R00's remaining investigation/ADR decisions are not thereby completed. R01 sequencing prevents concurrent overlapping edits, not this explicitly selected implementation.
- **Evidence:** A02; baseline `8df63f62aa778ef646002c42ddc8a06c04bc8c32` writes `mcpServers` into both workspace files. [VS Code 1.101 documentation](https://code.visualstudio.com/updates/v1_101#_mcp-development-mode) requires the `servers` envelope; [Cursor](https://cursor.com/docs/mcp) uses `mcpServers`. [VS Code 1.101 discovery source](https://github.com/microsoft/vscode/blob/1.101.0/src/vs/workbench/contrib/mcp/common/discovery/configMcpDiscovery.ts#L112-L119) has a compatibility conversion, so universal runtime rejection is not established. Release-source extension/manifest match this baseline; the earlier audit established VSIX 0.4.0 contents, not Marketplace publication, and that VSIX has not been reinspected for this change.
- **Scope / change:** Six files: `packages/vscode-stem/extension.js`, `packages/vscode-stem/tests/vscode-stem.test.ts`, MCP sections of `packages/vscode-stem/README.md` and `packages/vscode-stem/CONTRIBUTING.md`, this R02 record, and necessary `docs/status.md` updates. Separate host envelopes, explicit stdio, conservative preservation/refusal, staged writes, and narrowly recognizable legacy repair only during invoked setup. No test setup, engine, dependency or manifest change. User behavior and validation procedures live in the [extension guides](../../packages/vscode-stem/README.md#ai-context-server-mcp).
- **Exclusions:** No CLI discovery/version change, generic integration framework, or automatic repair outside explicitly invoked setup.
- **Dependencies / position:** Owner gate waiver/selection recorded above. R03 can still prevent unmodified end-to-end startup; isolate configuration recognition and report that limitation without fixing discovery here.
- **Acceptance:** VS Code gets `servers.stem`; Cursor gets `mcpServers.stem`; unrelated keys survive; repeated setup is idempotent; invalid JSON is not silently destroyed; actual VS Code recognizes the resulting server configuration.
- **Validation (10 October 2026):** Windows x64 / Node 26.7.0 / pnpm 11.2.2; isolated copy with existing dependency junctions, no install. Set `$env:pnpm_config_verify_deps_before_run = 'false'` only for these temporary-copy runs. Passed `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm test` (677 tests: core 288, CLI 267, extension 122), and `pnpm --filter @stemdev/cli smoke:built-cli`. Focused `pnpm --filter vscode-stem exec vitest run tests/vscode-stem.test.ts` passed 76 tests. Git-aware `node scripts/check-doc-budgets.mjs` and `git diff --check` passed in the real checkout. An initial suite run concurrent with packaging had five unchanged preview/schema parity failures; baseline `pnpm --filter vscode-stem exec vitest run tests/parity.test.ts -t 'excludes schema'` passed all nine selected cases, and the subsequent serial candidate suite passed. The transient failure's cause is not established.
- **Candidate inspection:** `pnpm --filter vscode-stem exec vsce package --no-dependencies --out C:\Users\Asus\AppData\Local\Temp\stem-r02-f9124e7a382842eb8611f3cc750b0a11\stem-r02-candidate.vsix` passed. Unpublished 0.4.0 candidate SHA-256: `F289B2682343E86729FA160732991BFE8A1795439115C144B7718A777639D084`; source identity is the baseline above plus this uncommitted six-file change. Seven ZIP entries: manifest/content types, extension manifest, bundled extension, README, changelog and license; no tests/source/fixtures. Separate envelopes, stdio and repair logic are present; engine remains `^1.101.0`. This candidate does not replace the previously audited release VSIX.
- **Host evidence / remaining acceptance:** A temporary extension-test harness loaded the extracted candidate with separate `--user-data-dir`, `--extensions-dir`, `--extensionDevelopmentPath` and `--extensionTestsPath`; npm was offline with a temporary cache. Cursor 2.3.41 (extension API 1.105.1) activated it and invoked the real setup command, producing both expected files. VS Code 1.126.0 activated it in an untrusted fixture and correctly wrote nothing; reading a copied candidate-generated configuration is not MCP recognition. Neither host supplied recognition evidence through the CodeLens probe. Native UI automation could not initialize, so trusted VS Code recognition, editor MCP listing/startup/tool use, home-global-source isolation, VS Code 1.101.x and remote checks remain unverified. No trust bypass, real editor configuration edit, MCP startup or publication was performed. Complete the [host checklist](../../packages/vscode-stem/CONTRIBUTING.md#mcp-validation) before accepting R02; keep R03 startup limitations separate.
- **Compatibility / rollback:** New extension release required. Existing generated configurations remain affected until explicitly repaired; publication alone cannot fix them. Revert scoped code/docs; configuration restoration requires a saved original and is separate from code rollback.

### R03: Resolve the configured or installed CLI without relying on version

- **Classification / priority / state:** Confirmed defect plus bounded Windows invocation verification; P2. Done; distribution candidate verified, publication pending R10. Medium; executable quoting/platform behavior is the main risk. On 10 October 2026 the owner reaffirmed deferral of historical core spec claims to the Pure Block Model migration, waived R00 for extension remediation, and explicitly approved the R03 implementation plan and validation. Remaining R00 governance decisions stay open.
- **Evidence / baseline:** A03a/A03b/A05b; baseline `9ea33f3b0a8f1ff6014dcd5be8871bcca0273893` probes unsupported `--version` and ignores `stem.cliPath` during MCP setup. Published CLI 0.3.0 has no version flag; R03 uses its supported `--help` instead.
- **Scope / change:** Seven files: extension `extension.js`, `package.json` setting description, `tests/vscode-stem.test.ts`, CLI-resolution sections of extension `README.md`/`CONTRIBUTING.md`, this R03 record/execution table, and `docs/status.md`. `tests/setup.ts` needed no change. Explicit executable/JavaScript paths (including workspace-relative paths and PATH command names) are validated before writes; failures notify without fallback. Otherwise discovery probes PATH candidates and uses npx only when none works. Native executables run directly; JavaScript entries use Node with Electron Node mode when needed; Windows shims use `cmd.exe /d /v:off /c` and a quoted path in `STEM_MCP_CLI`, preserving spaces and literal shell metacharacters. Existing valid MCP entries retain R02 preservation behavior; setting changes and regeneration are explained in the [usage guide](../../packages/vscode-stem/README.md#ai-context-server-mcp).
- **Exclusions:** No new CLI version flag, repository-relative fallback restoration, or CLI-driven preview.
- **Dependencies / position:** Owner waiver/plan approval recorded above; R02 source is already present. Independent of R09. Bundled-core preview remains in process.
- **Acceptance:** Valid explicit paths take effect; invalid explicit paths receive clear feedback; arguments and paths with spaces survive; PATH detection works with current published CLI; fallback occurs only under documented conditions. Windows `.cmd` behavior is verified, not assumed; distinguish mocks from actual Windows/POSIX evidence.
- **Validation (10 October 2026):** Windows x64 / Node 26.7.0 / pinned pnpm 11.2.2. Isolated tracked-file copy at `C:\Users\Asus\AppData\Local\Temp\stem-r03-9858d2bb87204a0592fbb39cb6ccf10a`, with existing dependency junctions and no install; set `$env:pnpm_config_verify_deps_before_run = 'false'` only for temporary-copy commands. Passed `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (715 tests / 42 suites: core 288, CLI 267, extension 160), `pnpm depcruise` (167 modules / 564 dependencies), and `pnpm --filter @stemdev/cli smoke:built-cli`. The command suite includes real JS, Windows `.cmd`/`.bat` and spaced `.exe` launch checks; the native `.exe` fixture is a copied Node executable, not a native Stem distribution. The initial lint run included two temporary experiment scripts at the copy root; moving them into ignored `.temp` and rerunning the exact lint command passed. In the real checkout, `node scripts/check-doc-budgets.mjs` passed 12 files and `git diff --check` passed; scope/protected-file review passed.
- **Published-CLI compatibility:** `node .temp/real-cli.cjs` in the isolated copy exercised the setup command with mocked editor APIs and actual child processes. Reused the retained exact-version `@stemdev/cli` 0.3.0 consumer from the 8 October audit (`stem-audit-20261008-af9da6c2/consumer`), exposed through a temporary junction whose path contains spaces, `&`, literal `%PATH%` and `!`; no registry operation was performed. Absolute JS, relative JS, explicit published `.cmd` shim, and PATH-discovered published shim all passed `--help`, generated matching host-specific entries, then completed MCP initialization and tool discovery through those entries without substitutions. Invalid explicit paths notified with zero configuration writes; empty PATH produced the exact npx fallback without executing/downloading it. Results are saved in `real-cli-results.json` under the isolated copy.
- **Candidate inspection:** `pnpm --filter vscode-stem exec vsce package --no-dependencies --out C:\Users\Asus\AppData\Local\Temp\stem-r03-9858d2bb87204a0592fbb39cb6ccf10a\stem-r03-candidate.vsix` passed. Unpublished 0.4.0 candidate SHA-256: `E154143C7DEEEDF2FF57D730AB22BE8B3BB66C5F4A630FD903B383D3EB2652FD`; source identity is the baseline above plus this uncommitted seven-file change. Seven ZIP entries; `./dist/extension.js` matches the tested bundle, contains the supported probe and bundled-core preview, and has no `--version` probe. Manifest setting/README describe discovery; engine remains `^1.101.0`; source/tests/maps/dependencies are excluded. VSCE emitted npm environment and bundle-size notices, with no packaging error. Inspection is saved in `vsix-inspection.json` under the isolated copy.
- **Limits / release:** Actual Windows process checks passed; no native POSIX, macOS, remote extension host, or real editor MCP UI/startup validation was performed for R03. Mocked editor APIs plus real MCP processes verify discovery/serialization/launch, not editor recognition; R01/R02 host acceptance remains separate. No release, publication, dependency change, or real user MCP configuration edit occurred. Consumer delivery requires R10.
- **Compatibility / rollback:** Extension-only release supports existing CLI 0.3.0. No CLI API change. Revert scoped code/docs; any generated user configuration may require independent restoration.

### R04: Correct CLI runtime dependency ownership

- **Classification / priority / state:** Maintainability improvement; P2 because consumer dependency ownership should reflect actual runtime use. Done; distribution pending. Small; low risk with packed-consumer checks.
- **Evidence:** A04a; direct production dependencies in `packages/cli/package.json`: `remark` and `unist-util-visit` serve `spike/parser-spike.ts`; direct `unified` use was not found in maintained runtime source.
- **Scope / change:** `packages/cli/package.json` and `pnpm-lock.yaml`. Move spike-only dependencies to devDependencies and remove the unused direct `unified` declaration after rechecking imports.
- **Exclusions:** No spike move/deletion, gray-matter/fast-glob replacement, general dependency upgrade, or claim that transitive packages disappear.
- **Dependencies / position:** R00 disposition; can follow the editor release checkpoint.
- **Acceptance:** Spike tooling remains typecheckable; all runtime imports are declared or intentionally bundled; packed CLI metadata has the intended ownership; clean consumers work without devDependencies or workspace links.
- **Validation:** Code profile and CLI packaging profile; inspect the exact packed dependency manifest and clean npm/pnpm installs.
- **Compatibility / rollback:** No intended API/CLI behavior change; installed consumers benefit only after a CLI release. Revert manifest and lockfile together, with task documentation; published metadata requires a corrective release.
- **Execution evidence (2026-10-11):** Baseline `8cf2bfa628b1f299cb8c32be12c4840055d34665`; changed files: `packages/cli/package.json`, `pnpm-lock.yaml`, `roadmap.md`, and `docs/status.md`. Windows; Node 26.7; repository-pinned pnpm 11.2.2. Runtime source scan found no imports of `unified`, `remark`, or `unist-util-visit` under `packages/cli/src`.
- **Code validation:** `pnpm install`, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck` (includes `spike/**/*.ts`), `pnpm lint`, `pnpm test` (715 passed), `pnpm depcruise` (167 modules / 564 dependencies), `pnpm --filter @stemdev/cli smoke:built-cli`, `node scripts/check-doc-budgets.mjs`, and `git diff --check` passed.
- **Packaging:** `pnpm --filter @stemdev/cli pack --pack-destination C:\Users\Asus\AppData\Local\Temp\stem-r04-pack-3dd50ebadc534524ad6d2c83623564cd` produced `@stemdev/cli@0.3.0` at `C:\Users\Asus\AppData\Local\Temp\stem-r04-pack-3dd50ebadc534524ad6d2c83623564cd\stemdev-cli-0.3.0.tgz`. Its manifest omits runtime `unified`, `remark`, and `unist-util-visit`, and retains `remark` and `unist-util-visit` only in devDependencies. `node scripts/verify-release-tarball.mjs C:\Users\Asus\AppData\Local\Temp\stem-r04-pack-3dd50ebadc534524ad6d2c83623564cd\stemdev-cli-0.3.0.tgz` passed.
- **Clean consumers:** `npm install --no-package-lock C:\Users\Asus\AppData\Local\Temp\stem-r04-pack-3dd50ebadc534524ad6d2c83623564cd\stemdev-cli-0.3.0.tgz` (npm 11.19.0) and `pnpm add --dir C:\Users\Asus\AppData\Local\Temp\stem-r04-pnpm-consumer-20261011 C:\Users\Asus\AppData\Local\Temp\stem-r04-pack-3dd50ebadc534524ad6d2c83623564cd\stemdev-cli-0.3.0.tgz` (pnpm 11.23.0) passed in temporary directories. Both resolved `@stemdev/core@0.1.0` without workspace links and passed `stem --help` and `stem init`. Distribution remains pending; no published artifact was verified.

### R05: Determine the smallest justified advisory remediation

- **Classification / priority / state:** Advisory investigation; P2. Done (11 October 2026); distribution not applicable. Reachable failures and the limits of each remedy are recorded below; no remediation was implemented.
- **Baseline / actual scope:** Clean `main` at `0af64f1ab933012134bfdaa376601d307e41980c`; Windows x64, Node 26.7.0, pnpm 11.2.2, npm 11.19.0. Only this R05 record/execution-order row and the dependency line in `docs/status.md` changed. Source, manifests, repository lockfile, protected files and released artifacts remain unchanged. Temporary consumers and bounded fixtures were kept outside the repository.
- **Audit evidence:** `pnpm audit --prod --json` returned exit 1: two high advisories and one moderate, all through CLI production dependencies. The table gives the exact workspace resolutions; direct CLI/core `js-yaml@5.4.3` is outside the affected YAML range. Counts of vulnerable parent packages are not counts of independent advisories.

| Advisory / workspace chain below `@stemdev/cli@0.3.0`                                                                                                           | Reachability and disposition                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): `fast-glob@3.3.3 > micromatch@4.0.8 > braces@3.0.3` (`<=3.0.3`)                       | Reachable through repository configuration, not ordinary Markdown content or filenames alone. Deep brace nesting reaches recursive expansion and can fail discovery; propose removing the configuration-to-glob interpolation. No published patched version was available.                                                         |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh): `gray-matter@4.0.3 > js-yaml@3.15.1` (`>=3.0.0 <3.15.2`)                              | Reachable during rename through repository view frontmatter, including content core rejected. Empty mapping merges consume work without consuming the old merge-key budget. A targeted refresh to published `3.15.2` is the smallest dependency remedy; broader removal needs a public API decision.                               |
| [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c): `gray-matter@4.0.3 > js-yaml@3.15.1 > argparse@1.0.10 > sprintf-js@1.0.3` (`<=1.1.3`) | Installed but no vulnerable format-string call is reachable through the traced Stem operations. `argparse` is imported by js-yaml's standalone `bin/js-yaml.js`, not its parser entry; Stem uses Commander. Removing gray-matter would remove this installation chain, but this advisory alone does not justify a runtime rewrite. |

#### Input tracing and bounded reproductions

- **Finder:** [finder.ts](../../packages/cli/src/runtime/fs/finder.ts) is the sole CLI fast-glob importer. Positive patterns are fixed (`**/*.md`, `**/*.{yaml,yml}`), but `findBlockFiles()` inserts the POSIX relative schema-directory path into `ignore` as `${schemasDirName}/**`. [Config normalization](../../packages/core/src/config/portable.ts) rejects absolute/parent paths but accepts braces and imposes no length/depth bound. Fast-glob's `processPatterns()` expands both input and ignore patterns through `micromatch.braces(..., { expand: true })`. A repository/PR-controlled `.stem/config.json` therefore reaches braces before any schema directory needs to exist; CLI/MCP operations that load a project inherit this path. `cwd` paths and discovered filenames are not themselves brace patterns.
- **Finder result:** An accepted schema path constructed as `'blocks/' + '{'.repeat(4996) + 'a,b' + '}'.repeat(4996)` produced `READ_FAILED` in the actual finder. Separate `generateTasks()` probing at depth 4900 caught `RangeError: Maximum call stack size exceeded`; the stack threshold varied with call context/warm-up. Stem's `scanFiles()` catches the exception, so this demonstrated an operation failure, not an uncaught process crash. Default paths and the shallow built-in schema pattern do not trigger this advisory.
- **YAML:** [rename.ts](../../packages/cli/src/runtime/operations/rename.ts) calls default `matter(content)` in block/dependency rewriting and view-body reference rewriting; [render.ts](../../packages/cli/src/runtime/operations/render.ts) calls it when reattaching view metadata. Gray-matter binds YAML parsing to v3 `safeLoad`; safe tags do not prevent this resource-exhaustion issue. Markdown from another contributor, an untrusted checkout or a CI pull request can supply the frontmatter. Both operations dump with the separately declared v5 loader, which does not remove the vulnerable v3 parse.
- **Validation gates:** [project.ts](../../packages/cli/src/runtime/operations/project.ts) returns core's parsed documents from `loadProjectGraph()` even when analysis contains errors. Rename can consequently find recovered view-body references and reparse that view through gray-matter. Render first checks project validation; the tested malicious views were rejected before any gray-matter call. This also applies to MCP `stem_render`, which delegates to render. A changed file between validation and reread remains a separate limitation; no render exploit was demonstrated.
- **YAML result:** Temporary view fixtures used `arr: &arr [{}, ...]` with N empty mappings and N `targets` each merging `*arr`, followed by a valid body reference to the renamed block. At N=200/800 (3,260/12,860 bytes), gray-matter parsed all targets; core reported `abnormal merge sequence size`. Actual rename succeeded with two instrumented v3 YAML calls (block and view), while render failed validation with zero calls. The v3 `mergeMappings()` source increments its budget only inside `Object.keys(source)`, establishing the N-by-N empty-source work. These small fixtures establish reachability, not a production CPU-exhaustion benchmark; no unbounded load was run.
- **sprintf result:** The same process exercised gray-matter, render and rename without loading `argparse` or `sprintf-js` into the CommonJS module cache. Source tracing agrees: no Stem input becomes a sprintf format string. This conclusion covers Stem's traced library use, not someone separately invoking the transitive js-yaml executable.

#### Remedy evaluation and separately proposed follow-up

1. **Smallest immediate scope:** Refresh only gray-matter's transitive `js-yaml` resolution from 3.15.1 to 3.15.2 in `pnpm-lock.yaml` (its existing `^3.13.1` range permits this; no direct v5 downgrade or major override). In `packages/cli/src/runtime/fs/finder.ts`, remove the schema-path-to-glob interpolation and exclude the schema subtree using literal path comparison after fixed-pattern discovery. Add focused regressions in `packages/cli/tests/fs/finder.test.ts` and `packages/cli/tests/operations/rename.test.ts`, plus these task/status records. Confirm exact path semantics and rerun the shared code/packaging profiles before approval of a release. These are proposed changes only. They mitigate the demonstrated paths but retain installed braces/sprintf advisory nodes; do not describe this as a clean audit.
2. **Gray-matter removal is not a public-helper swap today:** [core's public entry](../../packages/core/src/index.ts) exports `parseBlockFile`/`parseViewFile`, but not the raw `parseFrontmatter` helper in [frontmatter.ts](../../packages/core/src/parser/frontmatter.ts). Public parsed documents retain normalized fields and body text, not arbitrary frontmatter metadata needed by rename/render. Reconstructing metadata from them would lose custom keys. Importing core internals is prohibited. A clean removal can reuse that implementation only after an accepted ADR authorizes a minimal raw-frontmatter public contract and resolves the still-proposed [ADR-0002](../decisions/0002-frontmatter-yaml-core-schema.md) policy for these operations. Do not duplicate a parser in CLI or silently accept that ADR.
3. **Removal scope after that decision:** Core public entry and frontmatter contract/tests; CLI rename/render and their existing operation tests; CLI manifest and lockfile; existing API reference if the approved public contract requires it; task/status records. Consume raw data/body/diagnostics, preserve custom metadata and existing v5 dump formatting, and translate parse errors before any write. Test BOM/CRLF/body offsets, missing/empty/null/scalar/array frontmatter, malformed recovery, delimiters, YAML/YML labels, merges/timestamps/numeric normalization, unsupported tags/engines, dependency counts, code-fence exclusions, stdout/output paths, and no writes on parse failure. Reuse [core characterization](../../packages/core/tests/parser/frontmatter.test.ts). This removes gray-matter's v3/argparse-1/sprintf chain; required `js-yaml@5.4.3` and its argparse-2 dependency remain. Any new ADR/file or API export needs separately approved scope.
4. **Braces override/update:** The audit feed suggests `>=3.0.4`, but `npm view braces@3.0.4 version` returned E404 and latest braces remained 3.0.3. Latest fast-glob 3.3.3 and micromatch 4.0.8 still depend on the affected chain. Thus neither a verified version override nor an upstream update currently clears it; overriding to 3.0.3 does nothing. Likewise suggested `sprintf-js@1.1.4` returned E404. Do not invent patched versions or adopt an unreviewed fork. A workspace-only override/lock refresh also does not control downstream npm consumer resolution.
5. **Alternative scanner only if eliminating the installed chain is required:** A Node filesystem traversal can cover these fixed suffix searches and remove fast-glob from the CLI manifest/lockfile, but is broader than the literal-exclusion fix. Proposed scope is finder, its tests, extension discovery parity tests, manifest/lockfile and task/status records. Preserve absolute results, POSIX-relative `localeCompare` ordering, deduplication, lowercase suffix matching, hidden/ignored directory pruning, ignored `.gitignore`, missing-root/error behavior, custom Windows/backslash paths, and literal schema-subtree exclusion. Compare file links, Windows junctions, broken links, permission failures and cycles before selecting it. [Existing parity tests](../../packages/vscode-stem/tests/parity.test.ts) provide the baseline, not proof for a replacement; POSIX directory links/cycles and native macOS behavior remain unverified. Do not assume Node glob or a new glob package has identical behavior or a clean dependency tree.

#### Validation and evidence identity

- **Registry checks:** `pnpm audit --prod --json`; `npm view braces version`; `npm view braces@3.0.4 version`; `npm view fast-glob version dependencies --json`; `npm view micromatch version dependencies --json`; `npm view gray-matter version dependencies --json`; `npm view js-yaml@3.15.2 version dependencies --json`; `npm view sprintf-js@1.1.4 version`. The YAML patch exists but still depends on argparse 1, retaining sprintf. Network-enabled retries completed after sandboxed pnpm attempts stalled.
- **Clean consumer:** The retained baseline consumer lacked an npm lockfile (`npm audit` returned `ENOLOCK`), so a fresh isolated manifest pinned `@stemdev/cli` 0.3.0 and `@stemdev/core` 0.1.0 in `C:\Users\Asus\AppData\Local\Temp\stem-r05-consumer-20261011`. There, `npm install --ignore-scripts --omit=dev --no-fund --no-audit` and `npm ls @stemdev/cli @stemdev/core fast-glob micromatch braces gray-matter js-yaml argparse sprintf-js --all` succeeded. `npm audit --omit=dev --json` reported eight affected package nodes (four high/four moderate), representing braces and sprintf advisories. It resolved gray-matter's YAML to **3.15.2**, so the workspace's YAML advisory was absent; other chain versions matched the table. This verifies fresh resolution of existing published versions, not a remediated release. Consumer lock SHA-256: `AF69176F501C24AD2FB30A6827870080F6C0EABB92775E5F518BC96FE76C815B`.
- **Reproductions:** From the repository root, `node --import ./packages/cli/node_modules/tsx/dist/loader.mjs C:/Users/Asus/AppData/Local/Temp/stem-r05-consumer-20261011/reachability.mjs` exercised the bounded YAML fixtures, real rename/render, module-load evidence and public exports; the separate `braces.mjs` at the same path reproduced the 4996-depth finder failure using the same command prefix. Both exited zero; failures under investigation were captured as results. These temporary scripts are local evidence, not new tracked tests; input recipes and source paths above retain the finding if temporary files are removed.
- **Documentation acceptance:** `node scripts/check-doc-budgets.mjs`, `git diff --check`, and scoped/protected-file diff review passed. No code build or full test run was required for this documentation-only investigation. Windows-only bounded results do not certify replacement parity or general exploit absence.
- **Compatibility / rollback:** Investigation completion closes R05 only. Follow-up implementation, ADR decisions and R10 release verification remain separately authorized; published exposure is not closed. Correct/revert these conclusions if contradicted by new evidence.

### R06: Align existing repository guidance with the released architecture

- **Classification / priority / state:** Maintainability improvement; P2 because obsolete instructions misdirect contributors and consumers. Done; distribution pending under R10 for packaged README changes. Medium; documentary scope only.
- **Evidence:** A05a/A07d/A08; root guidance still describes two packages, obsolete architecture links/commands, the MCP roadmap checkbox, and CLI type boundaries predating extraction. Existing released exports are the baseline, not an invitation to restore removed types.
- **Scope / change:** Root `README.md`, root `CONTRIBUTING.md`, `docs/architecture.md`, all three package READMEs (including new `packages/core/README.md`), this roadmap, and `docs/status.md`. Corrected three-package discovery, supported commands/MCP capabilities, links, completed MCP roadmap status, ESM/public import examples, and extraction-related type guidance. Architecture links accepted ADRs; extension settings and R01-R03 setup guidance were rechecked against the manifest and retained.
- **Owner authorization (11 October 2026):** Owner selected R06, explicitly lifted D03 to create the core README, approved the eight-file scope and implementation plan, and authorized the documentary alignment with the released architecture. This is the scoped exception to the new-document prohibition; no ADR acceptance or protected-instruction change is implied. Remaining R00 policy questions stay open.
- **Exclusions:** No protected instruction edit, ADR acceptance, other new document, generated API edit, compatibility wrapper, runtime/dependency change, or extension contribution-guide rewrite.
- **Dependencies / position:** The owner disposition above permits this bounded documentation task; unresolved policies are linked without describing them as accepted.
- **Acceptance:** Referenced paths and commands match current manifests; old CLI domain/config exports are not promised; examples use public entries; accepted architecture is explained without changing it. Core's actual renderer export is `renderViewMarkdown`, locally aliased to `renderView` in its example rather than inventing an export.
- **Validation (11 October 2026):** Windows x64, Node 26.7.0, pnpm 11.2.2; source baseline `757035b4107304316b7c986b8f747f9baf73e921`. `pnpm build`, `pnpm test` (715 tests in 42 suites), `pnpm typecheck`, and `pnpm --filter @stemdev/cli smoke:built-cli` passed. `node scripts/check-doc-budgets.mjs` passed (12 files; status 40 lines), `git diff --check` passed, and `node "$env:TEMP/stem-r06-links.mjs"` verified 88 local Markdown paths/anchors and repository contribution links across all eight scoped documents. Command registrations, MCP capabilities, extension settings/defaults, manifests, and release workflow were compared directly.
- **Consumer examples:** `pnpm --filter @stemdev/core pack --pack-destination "$env:TEMP/stem-r06-20261011"` and the equivalent CLI command produced local tarballs. `npm install --prefix "$env:TEMP/stem-r06-20261011/consumer" --offline --ignore-scripts --no-audit --no-fund "$env:TEMP/stem-r06-20261011/stemdev-core-0.1.0.tgz" "$env:TEMP/stem-r06-20261011/stemdev-cli-0.3.0.tgz"` installed both in isolation. `node "$env:TEMP/stem-r06-examples.mjs"` extracted the exact TypeScript examples, typechecked against installed package declarations, executed and asserted their results, ran the CLI quickstart against temporary project files, and checked help for MCP/setup and namespace commands. This caught and corrected the quickstart's missing generated ID suffixes. Temporary check scripts/artifacts are validation aids, not new repository files.
- **Extension candidate:** `pnpm --filter vscode-stem exec vsce package --no-dependencies --out "$env:TEMP/stem-r06-20261011/stem-r06.vsix"` passed; inspected the seven-entry archive, bundled `extension/dist/extension.js`, packaged README, and extension-specific contribution/MCP validation URLs. No real editor-host or published-consumer certification is claimed. Initial sandboxed pnpm verification/npm cache access failed; approved retries passed. VSCE reported the existing bundle-size notice and npm environment-config warning; no tool upgrades were made.
- **Compatibility / rollback:** No runtime/API change. Repository guidance takes effect in Git; packaged core/CLI/extension README corrections need release. Revert only scoped prose if inaccurate.

### R07: Regenerate the CLI API reference

- **Classification / priority / state:** Maintainability improvement; P2 because the checked-in reference disagreed with the released declarations. Done; distribution not applicable. Small; existing tool versions retained.
- **Evidence:** A05c/A08; `packages/cli/docs/stem-api.d.ts` includes pre-extraction declarations (audit references near lines 11 and 315 onward), while published declarations passed consumer checks.
- **Scope / change:** Regenerate only `packages/cli/docs/stem-api.d.ts` using its existing API Extractor configuration, plus task/status records.
- **Exclusions:** No hand-editing generated declarations, export change, tool upgrade, configuration rewrite, or other generated artifact update.
- **Dependencies / position:** None; use the current approved source baseline.
- **Acceptance:** Passed: reference reflects the current public CLI entry with nine core type imports, removes stale embedded domain/config/parser/validation declarations and `isExternalStemGraphShape`, and makes `ResolvedStemConfig` extend `PortableStemConfig`. No source, exports, dependencies, or configuration changed; generated declarations were not hand-edited.
- **Validation (11 October 2026):** Windows x64, Node 26.7.0, pnpm 11.2.2; clean baseline `6b0f5d6f4fa285f420b272f7e03ec487d77ffefc` includes committed R06. `pnpm --filter @stemdev/core build`, `pnpm --filter @stemdev/cli docs:types`, `pnpm --filter @stemdev/cli typecheck`, and a second `pnpm --filter @stemdev/cli docs:types` passed. Both generations have SHA-256 `1C4A82F1E4F06EEA3C6F77EB6783298347A61BE26894F41F9FE6451D042C78C4`, confirming byte-identical output and diff. API Extractor 7.59.0 warned that its bundled TypeScript 5.9.3 is older than project 6.0.3; no upgrades made. The sandboxed pnpm launcher stalled; approved execution outside the sandbox succeeded.
- **Repository checks:** `pnpm --filter @stemdev/cli test` passed (267 tests in 25 suites); `pnpm --filter @stemdev/cli smoke:built-cli` passed. `node scripts/check-doc-budgets.mjs` passed (12 files); `git diff --check` passed. Reviewed the complete diff and `git diff --name-only`: only the three approved files changed, with no protected-file edits. No runtime or published-consumer certification is claimed by this documentation task.
- **Compatibility / rollback:** Generated documentation only; revert that file and task/status updates. No publication required for the repository reference.

### R08: Correct the packaged extension contribution link

- **Classification / priority / state:** Confirmed documentation defect; P2 because extension contributors were sent to the wrong guide. Done; candidate verified, publication pending under R10. Small; low risk.
- **Evidence:** A07c; published VSIX README contribution link resolves to root `CONTRIBUTING.md`. Planning inspection of installed VSCE `out/package.js`, `guessBaseUrls()` around line 703, found it uses repository URL/branch and not `repository.directory`; D02 alone is not this fix.
- **Scope / change:** `packages/vscode-stem/README.md`, this R08 record and execution-order row, and the editor remediation line in `docs/status.md`. The contribution link uses the explicit URL `https://github.com/stemdev-hub/cli/blob/main/packages/vscode-stem/CONTRIBUTING.md`.
- **Exclusions:** No repository metadata change, release-workflow edit, or broader guide rewrite.
- **Dependencies / position:** No technical prerequisite; schedule after R01/R03 guide corrections where practical.
- **Acceptance:** The repository README and packaged `extension/readme.md` lead to the existing extension-specific guide. Passed.
- **Validation (10 October 2026):** Windows x64, Node 26.7.0, pnpm 11.2.2; baseline `8e00f94304d67a7561b586dc0c864c4400010c0c`. `node scripts/check-doc-budgets.mjs` passed (12 files); `git diff --check` passed. `pnpm --filter vscode-stem exec vsce package --no-dependencies --out "C:\Users\Asus\AppData\Local\Temp\stem-r08-candidate-20261010.vsix"` passed (VSCE 0.4.0; 7 files). Inspected `extension/readme.md` in that VSIX and confirmed the Contributing Guide URL targets `packages/vscode-stem/CONTRIBUTING.md`. Candidate SHA-256: `EDD1F19ED96BEC952E751B69C15CA804FE02717C53088CBA71148D040151073B`.
- **Compatibility / rollback:** New VSIX needed for published readers; no runtime change. Revert the link if needed; already released VSIX needs a corrective version.

### R09: Add package-derived CLI version reporting

- **Classification / priority / state:** Maintainability improvement; P2 for diagnostics/support, not a broken documented contract. Deferred; distribution pending if selected. Small, subject to further decomposition if release timing changes are required.
- **Evidence:** A03c; published CLI 0.3.0 rejects `--version`. R03 must work without it.
- **Scope / change:** `packages/cli/src/cli/index.ts`, `packages/cli/tsup.config.ts`, `packages/cli/tests/cli/index.test.ts`, `packages/cli/tests/smoke/built-cli-smoke.mjs`, and CLI `README.md`. Derive version reporting from package metadata without repository-relative consumer reads.
- **Exclusions:** No independently hardcoded version, public export change, extension coupling, or unapproved release-workflow edit.
- **Dependencies / position:** Explicit task selection and R00 disposition. Not a prerequisite for any urgent editor repair.
- **Acceptance:** Built/packed `stem --version` exits zero and equals the packed package version for stable and canary artifacts. Inspect release version-rewrite timing: if it occurs after version embedding, stop and propose the smallest expanded scope before editing workflow files.
- **Validation:** Code profile, CLI packaging profile, and isolated stable/canary version simulation. Exact simulation commands remain to be established from the selected release baseline; never publish as a test.
- **Compatibility / rollback:** Additive CLI behavior; new CLI release required. Revert scoped source/build/tests/docs; published artifacts require a corrective release. Build-time version staleness is the principal risk.

### R10: Verify an authorized release delivers selected fixes

- **Classification / priority / state:** Release checkpoint; P1 because consumers require verified artifacts delivering source fixes. Candidate verified; publication pending explicit release authorization. Medium; irreversible distribution requires a concrete candidate.
- **Evidence:** A09 and baseline source/artifact comparison. Git commits do not demonstrate consumers receive working artifacts without packaging verification.
- **Scope / change:** Inspect candidate tarballs/VSIX, static manifest/type verifiers, and clean consumers.
- **Exclusions:** No unapproved registry publish operation, no git tagging/pushing, and no assumption that local build proves Marketplace/npm delivery.
- **Dependencies / position:** Source tasks R01-R08 complete; explicit release approval required before registry publication.
- **Acceptance:** Passed: candidate artifacts inspected, dependencies rewritten without workspace protocols, publint/attw pass, VSIX bundle contains only required runtime files and corrected guide links, and isolated clean consumers execute successfully.
- **Validation (11 October 2026):** Windows x64, Node 26.7.0, pnpm 11.23.0; source baseline `35584497e0e7a8848d7be08bfba2519114f4949d`. Built monorepo via `pnpm build && pnpm typecheck && pnpm lint`. Candidate artifacts generated in isolated temporary storage:
  - `@stemdev/core@0.1.0`: `stemdev-core-0.1.0.tgz` (19,634 bytes), SHA-256 `ADDF82489EE3A7F5E569EA9910FAA08FC68FED0EC7D74B29CD550E5B82D6B64F`. `node scripts/check-packed-core.mjs` passed (`publint` strict passed; `attw` ESM-only node16-esm and bundler passed).
  - `@stemdev/cli@0.3.0`: `stemdev-cli-0.3.0.tgz` (27,843 bytes), SHA-256 `4751108F68CF1ACE25831431F5E73957F241814A6D7DD0242C17C095ACCC12D2`. `node scripts/verify-release-tarball.mjs` passed (0 workspace protocols in dependencies; rewritten to `@stemdev/core@^0.1.0`).
  - `vscode-stem@0.4.0`: `vscode-stem-0.4.0.vsix` (114,612 bytes), SHA-256 `A43CC2D4F988AE4C15D8CC1B3A0F47FEFAD9449AA4878C40B8EB862AB23C6597`. Inspected 7 VSIX entries: bundled in-process `@stemdev/core` preview; excluded `src/`, `tests/`, and dev assets; verified `readme.md` includes corrected `packages/vscode-stem/CONTRIBUTING.md` URL and host-specific MCP table (`servers.stem` vs `mcpServers.stem`).
  - Isolated clean-consumer smoke tests (outside workspace): clean `pnpm` consumer installed `@stemdev/cli` and `@stemdev/core` from tarballs without workspace links; `stem --help` and `stem init` passed; Node script verified `@stemdev/core` parsing, graph building, and view rendering. Clean `npm` consumer installed `@stemdev/cli` and `@stemdev/core` from tarballs; `stem --help` passed.
- **Compatibility / rollback:** Preserves npm package names, public entries, `stem` executable, and extension identity. Before publication, abandon/revert candidate; after publication, use a corrective release.

### Deferred and rejected suggestions

| ID  | Suggestion / classification                                                                 | Disposition and reason                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Remove tracked install-npm consumer residue; optional P3                                    | Deferred until its example value is confirmed. Potential scope is only its `.gitignore`, `.stem/config.json`, `blocks/schemas/adr.yaml`, `blocks/schemas/api.yaml`, `blocks/smoke-block.md`, `views/smoke-view.md`, `package.json`, and `package-lock.json`; no deletion approved.                                                           |
| D02 | Add package repository.directory fields; optional P3                                        | Useful monorepo metadata, independently deferrable. Does not fix VSCE's contribution-link rewriting; R08 handles that root cause.                                                                                                                                                                                                            |
| D03 | Add a core README; optional                                                                 | Lifted by explicit owner authorization on 11 October 2026 and completed within R06's approved eight-file scope. See the R06 authorization and validation record above.                                                                                                                                                                       |
| D04 | Consolidate filesystem operation types/duplicates; optional P3                              | No demonstrated behavior defect; keep CLI-specific internal types until a concrete maintenance benefit justifies scope.                                                                                                                                                                                                                      |
| D05 | Split MCP into a new package or generic abstraction                                         | Rejected for this backlog: no separate consumer/runtime/release boundary demonstrated; new packages are prohibited.                                                                                                                                                                                                                          |
| D06 | Remove legacy extension helpers or typecheck its JavaScript entry; maintenance candidate P2 | Deferred pending usage/test inventory. Loader/tests are checked, legacy CommonJS entry is not typechecked and is ESLint-ignored. Avoid incidental removal during R01-R03.                                                                                                                                                                    |
| D07 | Shared namespace loader, local external snapshot producer, stricter fetchedAt               | Deferred pending namespace/snapshot ADR; see [remaining namespace issues](#remaining-namespace-issues). [ADR-0004](../decisions/0004-core-schema-and-snapshot-decoders.md) preserves decoder behavior. Do not treat external/internal snapshot names as a typo.                                                                              |
| D08 | Rename the outer local cli checkout                                                         | Optional/cosmetic P3; no architectural necessity. Moving a checkout can disturb local/editor paths and does not require renaming packages/cli.                                                                                                                                                                                               |
| D09 | Rename repository/public identities, adopt apps/, or add packages                           | Rejected for this scope: no concrete consumer benefit. Keep packages/cli, packages/core, packages/vscode-stem, npm names, public imports, executable, and extension identity. Any future repository/workflow rename must review trusted publishing separately.                                                                               |
| D10 | Upgrade tools to remove deprecation/API Extractor warnings                                  | Deferred; warnings alone do not justify upgrades or broaden remediation.                                                                                                                                                                                                                                                                     |
| D11 | Broaden runtime/platform certification                                                      | Deferred beyond the specific checks required by R01-R03/R10. Do not imply browser/macOS/POSIX guarantees from Windows tests or require browser support outside the core contract.                                                                                                                                                            |
| D12 | Clean ignored build output, caches, or local working material                               | Deferred; audit cleanliness is not authorization to remove local data.                                                                                                                                                                                                                                                                       |
| K01 | Keep existing structure/distribution boundaries                                             | Keep: reusable domain/parser/render/schema behavior in core; filesystem/Git/network/process/terminal/MCP adapters in CLI; VS Code integration in extension; repository CI/release tooling at root. Existing exports, assets, build ordering, and enforcement passed the audit. Source/maps/tests in artifacts are not automatically defects. |

### Human decisions

R00 requires owner disposition of ADR-0002 (accept the implemented policy or specify a revision), the three historical spec claims, and whether unresolved items block unrelated implementation. No acceptance or gate exception is implied by recording this backlog.

Protected instructions need owner-applied corrections: root AGENTS should list core as existing; CLI guidance should describe completed extraction; extension guidance should match its current scripts/tests and bundled-core preview. Preserve their constraints. Agents report proposed lines in chat rather than editing these files.

Optional version reporting and cosmetic cleanup can remain deferred. Release versions/channel and any publishing merge require a concrete, separately approved candidate. No other preference decision should block preparation of the first bounded investigation.

### Implementation workflow

1. Select one task or tightly coupled task group; confirm approved file scope, current baseline, dependency disposition, and exact tool/package versions.
2. Implement only that outcome, including its behavior documentation and necessary status updates. Record adjacent discoveries as separate proposed tasks; if additional files are strictly necessary, obtain scope approval before editing them.
3. Run targeted acceptance checks and the applicable shared/repository checks. Review the complete diff, including generated output and lockfile, for unrelated changes and protected-file edits.
4. Record exact commands/results, artifact identity, platform limitations, and remaining release work in the task record. Update status links without duplicating the task definition.
5. Mark source work done only after acceptance passes. Keep distribution pending until the intended published artifact passes R10; do not confuse a merged change with consumer delivery.
6. Report completion and remaining release steps before selecting the next approved cycle. Do not expand scope silently.

Recommended first task: R00, because it resolves the explicit implementation gate without speculative code changes. Once permitted, R01 is the first code task: a small, reproducible published editor defect with an existing core API remedy.

## Preserved status before migration

The following observations are the former status file, including the disproved claim and stale summaries corrected above.

# Status

Agent-editable. Budget: 60 lines. Delete items when resolved.

## Open spec bugs (resolve before further implementation)

- `resolveBlockSelection()` returns array for tag refs; substitution site expects string; no merge rule for duplicate tags under warning.
- `GraphEdge.to` typed as local node id; namespace refs target nodes never in local `nodes` map.
- "tags" used in three senses (frontmatter labels, `@stem[tag:name]` fragments, `StemSection.tags`). Proposed: rename frontmatter field to `labels`.
- These are historical claims, not newly verified defects. [R00](#r00-establish-which-status-items-block-implementation) owns their disposition; the owner's deferral to the Pure Block Model migration and extension-remediation gate waiver are recorded in [R01](#r01-use-core-semantics-when-opening-a-view-preview).

## Open policy

- Pure Block draft contracts and remaining decisions are linked from the [migration backlog](#pure-block-migration); product acceptance and implementation remain pending.
- Current transclusion depth/cycle-warning policy remains unresolved; proposed Pure Block behavior and numeric budget defaults are tracked in the migration backlog above.
- ADR-0002 acceptance and protected-instruction corrections require the [human decisions](#human-decisions); no policy change is implied by the audit.

## Post-publication remediation

- Core extraction and first coordinated stable releases are complete. See the [8 October 2026 audit baseline](#audit-baseline) for source/artifact identity, checks, and coverage limitations.
- Detailed tasks and their statuses live only in the [remediation backlog](#repository-remediation). [R01-R03 and R08 implemented](#execution-order). Release execution remains separately authorized through R10.
- Follow the [execution order](#execution-order) subject to explicit owner dispositions recorded in the selected task; R00 remains open for its remaining decisions.
- Editor remediation: [R01](#r01-use-core-semantics-when-opening-a-view-preview) and [R02](#r02-serialize-mcp-configuration-separately-for-vs-code-and-cursor) retain separate host acceptance; [CLI discovery R03](#r03-resolve-the-configured-or-installed-cli-without-relying-on-version) is done with a verified candidate; packaged contribution link [R08](#r08-correct-the-packaged-extension-contribution-link) is done with a verified VSIX candidate. Published-consumer verification remains under R10.
- Dependency work: [ownership R04](#r04-correct-cli-runtime-dependency-ownership) is done; [advisory investigation R05](#r05-determine-the-smallest-justified-advisory-remediation) is done with reachability evidence and bounded follow-up scopes. Remediation and ADR-gated dependency removal remain unimplemented; published exposure remains open.
- Documentation work: [guidance R06](#r06-align-existing-repository-guidance-with-the-released-architecture) is done, including the owner-authorized core README; packaged guidance candidate verified under R10. [Generated API R07](#r07-regenerate-the-cli-api-reference) is done; [published guide link R08](#r08-correct-the-packaged-extension-contribution-link) is source-complete.
- Optional version support is [deferred R09](#r09-add-package-derived-cli-version-reporting); it does not block extension discovery repair. Other suggestions are in the [deferred register](#deferred-and-rejected-suggestions).
- Track source completion separately from [published-consumer verification R10](#r10-verify-an-authorized-release-delivers-selected-fixes); candidate tarballs and VSIX verified, publication pending.

## Remaining namespace issues

- External graph format `.stem/cache/stem-graph.json` (ExternalStemGraph) differs from sync's `graph.json` (internal GraphSnapshot); this is not a filename bug. Only `publishGraph()` produces the external format and it does not save it locally, so local-only namespace use has no producer. Decide via ADR before building a shared namespace loader.
- External snapshot types exported from core remain provisional until the namespace/snapshot ADR.
- Snapshot envelope `fetchedAt` is not validated as a date; [ADR-0004](../decisions/0004-core-schema-and-snapshot-decoders.md) preserves this behavior. Revisit with the namespace ADR.
- CLI/extension namespace loading policy remains duplicated pending that decision; see [deferred D07](#deferred-and-rejected-suggestions).

## Remaining validation and release constraints

- Real extension-host behavior remains unverified; previously passing Windows file-link/junction/broken-link parity does not verify cyclic links or native POSIX directory symlinks. See [audit limits](#audit-baseline) and task-specific acceptance checks.
- Prior status reported 24 deprecation warnings for `@yuku-parser/binding-win32-x64` through core's tsdown development dependency; not reverified by backlog creation and not a demonstrated development blocker.
- Preserve the configured `release-please.yml` workflow identity and review trusted-publisher settings before any future repository/workflow rename. Release execution is separately authorized through R10; core-first ordering remains governed by [ADR-0001](../decisions/0001-extract-core-package.md).
- Re-run `npm audit --omit=dev` on the packed consumer install before each release.
- CI workflow linting (actionlint) and upgrading `actions/upload-artifact@v7` are deferred until the Pure Block model migration completes.

## Follow-up corrections (20 October 2026)

After the migration and subsequent review, the owner approved the correction plan, including explicit acceptance of ADR-0002 and adoption of the former hard/soft-edge axiom retirement. This later approval resolves the earlier pending items; the assessment, original records and initial migration evidence above retain their historical wording.

- [ADR-0002](../decisions/0002-frontmatter-yaml-core-schema.md) is now accepted, with the approved portable-parser scope clarification recorded at acceptance. Architecture/reference navigation was updated and its authority inconsistency removed from active R00 work. Node-side gray-matter helpers remain an acknowledged limitation.
- [ADR-0005](../decisions/0005-pure-block-model.md#consequences) now identifies the model specification as owner of D23 schema-transition behavior and roadmap as owner of execution/deferral. It remains proposed; ADR-0004 remains accepted in full.
- [CLI configuration](../../packages/cli/README.md#configuration) now identifies the configurable internal index/graph location and distinguishes fixed namespace-snapshot paths. CONTRIBUTING links to those owning policies instead of requiring all caches under one fixed path. No cache implementation changed.
- [ADR-0009](../decisions/0009-retire-hard-soft-edge-axiom.md) records retirement of the former hard/soft-edge axiom using the actual approval date. The pre-existing axioms file contents were not edited again; the prior deletion was pending until this approval. Current behavior and the status of product proposals remain unchanged.
- Notices were prepended to the six ignored local documents listed in the assessment inventory. Root `prd.md` is identified as provisional/nonbinding; the five migration records are historical/nonbinding. Their original bodies, paths and ignored status are preserved. They were not imported into maintained documentation.

Other R00 questions, product ADR-0005/0007 and specification acceptance, host/distribution verification, and the private security-reporting route remain open under their existing owners. No new edits were made to governance, AGENTS, axioms, rules, existing accepted ADR bodies, or runtime code. ADR-0002's scope clarification was approved as part of its acceptance; only the still-proposed ADR-0005 received the editorial ownership correction.

Verification for this follow-up: all 43 repository-owned Markdown files passed static checks (385 local/repository links and 32 canonical Pure Block labels); all 89 original heading targets remain present. The six ignored notices supplied 12 additional checked links, and byte comparisons confirmed that their original bodies and the prior audit text were preserved. All other files matched the pre-follow-up hashes, including protected files, existing accepted ADRs and runtime source; HEAD and the Git index were unchanged.

Fresh checks passed: 46 frontmatter tests, 267 CLI tests, 11 documentation-check tests, CLI build/typecheck/built smoke, seven-file documentation budgets, documented core/reference examples, generated CLI-reference comparison and whitespace checks. The CLI bundler initially encountered sandbox access denial; the same verification sequence passed with approved broader execution. API Extractor retained its previously recorded TypeScript-version notice. These checks do not supply new real-host, distribution or security certification. No staging, commit or publication occurred.

## Consumer residue cleanup (20 October 2026)

The owner approved removal of the eight tracked `install-npm/` files and their documentation-checker exclusions. Remediation D01 is complete: the folder depended on missing CLI 0.2.1/core 0.1.0 tarballs, contained only generated configuration/templates and a minimal empty-block/view example, and supplied no automated assertions. Its original deferred assessment above remains historical evidence.

The maintained [built-CLI smoke test](../../packages/cli/tests/smoke/built-cli-smoke.mjs) exercises initialization, creation, validation, cache synchronization and rendering in a temporary project. [Packed-consumer verification](../../CONTRIBUTING.md#verification) remains a separate check of installed artifacts; the built smoke test does not replace it. Ignored local dependencies were left untouched.

Resolved R00 investigations were reduced to history links while retaining the observed tag-only limitation and open policy questions. API Extractor's stock template comments and inactive examples were removed; every parsed configuration setting was preserved. Parser-spike inputs and implementations, historical bodies, compatibility pointers, and ignored local design notes were retained.

Verification: 267 CLI tests and 11 documentation-check tests passed, along with CLI build/typecheck/built smoke, seven-file documentation budgets, documented examples and generated-reference comparison. Static checks covered 41 Markdown files, 388 local/repository links and all 32 canonical Pure Block labels. API Extractor retained its existing compiler-version notice. The pnpm wrapper produced no output and was interrupted; the required checks passed through the installed local tool entry points. No new packed-consumer, editor-host or distribution certification was performed.
