# Stem Roadmap

This document outlines the post-MVP roadmap for Stem, starting with foundational core updates and moving towards major AI and web integrations.

## Phase 1: Foundational Core Updates

These are internal architecture improvements to prepare the codebase for complex integrations without breaking existing functionality.

- [x] **Namespace Syntax:** Update ID validation to accept namespaces (e.g., `@stem[block:my-repo:auth-flow]`). This is the necessary groundwork for cross-project references.
- [x] **Cross-Project References:** Implement `stem publish-graph` and `stem fetch-namespaces` CLI commands to safely map, cache, and validate structural snapshots across different repositories.
- [x] **Machine-Readable CLI Output:** Add a `--json` flag to commands like `stem check` and `stem list` to output structured JSON arrays, enabling trivial CI/CD integration.

## Phase 2: Major Integrations

These features fulfill Stem's core mission: bridging the gap between active code and AI coding agents.

- [ ] **MCP Server (Model Context Protocol):** Build the `stem mcp` command to expose the dynamic graph and blocks directly to AI agents (like Claude and Cursor). This allows AIs to intelligently navigate the codebase context.
- [ ] **Live Code References:** Implement the `@stem[code:path/to/file.ts#L10-L20]` directive, allowing blocks to transclude real source code that updates automatically, solving documentation staleness.

## Phase 3: Publishing and User Interface

Features focused on human readability and distribution.

- [ ] **HTML Export & Publishing:** Add an HTML pipeline to generate static websites from the Markdown, and create a GitHub Action for automated publishing.
- [ ] **Web UI:** Build a local server (`stem serve`) to visually browse the connection graph (e.g., using D3.js or React Flow) and read views in a browser.

## Phase 4: Advanced Graph Features

- [ ] **Localization:** Support for fallback view/block resolution (e.g., falling back to `en` if `es` is missing).
- [ ] **External Sources:** Pulling OpenAPI specs or GraphQL schemas as virtual blocks.

## Repository remediation

Prepared 9 October 2026 from the repository audit dated 8 October 2026. Approval covers recording this backlog only. No implementation, release, registry change, or external issue is authorized. Detailed task definitions, task status, and validation evidence belong here; [current status](docs/status.md) links here. The product roadmap above is preserved pending R06.

Follow [repository instructions](AGENTS.md), [governance](docs/governance.md), and the [stem-docs skill](.agents/skills/stem-docs/skill.md). This backlog preserves the Block and Tag model and proposes no new package or primitive.

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
| A07d / 7: core discovery/package README                                | Existing-document improvement; new document deferred                      | R06 and D03                              |
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
| 5                  | R08: packaged contribution link                | P2       | No technical prerequisite; preferably after guide corrections in R01/R03 | Small  | Proposed                                      |
| Release checkpoint | R10: selected fixes reach consumers            | P1       | Only the selected source tasks and explicit release approval             | Medium | Proposed                                      |
| 6                  | R04: CLI dependency ownership                  | P2       | R00 disposition                                                          | Small  | Proposed                                      |
| 7                  | R05: advisory investigation                    | P2       | None; can run earlier without waiting for R04                            | Medium | Proposed                                      |
| 8                  | R06: repository guidance                       | P2       | Relevant R00 governance decisions                                        | Medium | Proposed                                      |
| 9                  | R07: generated API reference                   | P2       | None; use the current approved source baseline                           | Small  | Proposed                                      |
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
- **Evidence:** A06a/A06b; the three [open spec claims](docs/status.md#open-spec-bugs-resolve-before-further-implementation), proposed [ADR-0002](docs/decisions/0002-frontmatter-yaml-core-schema.md), and references in `docs/rules.md`. Renderer handling and existing duplicate-fragment tests mean historical status wording alone is insufficient evidence that all claims remain defects.
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
- **Host evidence / remaining acceptance:** Extracted candidate loaded via a temporary `host-validation/harness.cjs` using `--extensionDevelopmentPath`, `--extensionTestsPath`, `--new-window`, separate `--user-data-dir` / `--extensions-dir`, and disposable workspace fixtures under the isolated copy. Cursor 2.3.41 (API 1.105.1, trusted) invoked the real `stem.previewToSide` command and native Markdown command: ordinary, quoted-key/ID, YAML-opener and Unicode-escape cases produced the expected virtual document contents from unsaved views/blocks; unsaved block auto-refresh passed; malformed YAML, missing ID and numeric ID opened no new preview. Disk contents remained unchanged. VS Code 1.126.0 refused preview in its untrusted fixture. Reports/logs remain under `host-validation`; both test hosts exited. Host logs included Cursor native-module, missing optional schema directory and `ENOPRO` diagnostics, plus a VS Code mutex diagnostic, so this is API/document evidence, not proof of visual Markdown rendering or notification presentation. Native UI control is unavailable; complete the [manual preview checklist](packages/vscode-stem/CONTRIBUTING.md#manual-test-checklist), including trusted VS Code preview, before marking R01 done. No trust bypass, MCP configuration edit, or publication occurred.
- **Compatibility / rollback:** Existing core/API/CLI identities unchanged. Consumers need a new extension release through R10. Revert the scoped source/tests/docs together; a published VSIX needs a corrective version rather than overwriting the old artifact.

### R02: Serialize MCP configuration separately for VS Code and Cursor

- **Classification / priority / state:** Confirmed serialization-contract defect; P1. Implemented with automated validation passed; real-host acceptance and distribution pending. Medium; user-configuration preservation is the main risk. On 10 October 2026 the repository owner approved this six-file implementation and waived the R00 core spec gate for extension remediation tasks; R00's remaining investigation/ADR decisions are not thereby completed. R01 sequencing prevents concurrent overlapping edits, not this explicitly selected implementation.
- **Evidence:** A02; baseline `8df63f62aa778ef646002c42ddc8a06c04bc8c32` writes `mcpServers` into both workspace files. [VS Code 1.101 documentation](https://code.visualstudio.com/updates/v1_101#_mcp-development-mode) requires the `servers` envelope; [Cursor](https://cursor.com/docs/mcp) uses `mcpServers`. [VS Code 1.101 discovery source](https://github.com/microsoft/vscode/blob/1.101.0/src/vs/workbench/contrib/mcp/common/discovery/configMcpDiscovery.ts#L112-L119) has a compatibility conversion, so universal runtime rejection is not established. Release-source extension/manifest match this baseline; the earlier audit established VSIX 0.4.0 contents, not Marketplace publication, and that VSIX has not been reinspected for this change.
- **Scope / change:** Six files: `packages/vscode-stem/extension.js`, `packages/vscode-stem/tests/vscode-stem.test.ts`, MCP sections of `packages/vscode-stem/README.md` and `packages/vscode-stem/CONTRIBUTING.md`, this R02 record, and necessary `docs/status.md` updates. Separate host envelopes, explicit stdio, conservative preservation/refusal, staged writes, and narrowly recognizable legacy repair only during invoked setup. No test setup, engine, dependency or manifest change. User behavior and validation procedures live in the [extension guides](packages/vscode-stem/README.md#ai-context-server-mcp).
- **Exclusions:** No CLI discovery/version change, generic integration framework, or automatic repair outside explicitly invoked setup.
- **Dependencies / position:** Owner gate waiver/selection recorded above. R03 can still prevent unmodified end-to-end startup; isolate configuration recognition and report that limitation without fixing discovery here.
- **Acceptance:** VS Code gets `servers.stem`; Cursor gets `mcpServers.stem`; unrelated keys survive; repeated setup is idempotent; invalid JSON is not silently destroyed; actual VS Code recognizes the resulting server configuration.
- **Validation (10 October 2026):** Windows x64 / Node 26.7.0 / pnpm 11.2.2; isolated copy with existing dependency junctions, no install. Set `$env:pnpm_config_verify_deps_before_run = 'false'` only for these temporary-copy runs. Passed `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm test` (677 tests: core 288, CLI 267, extension 122), and `pnpm --filter @stemdev/cli smoke:built-cli`. Focused `pnpm --filter vscode-stem exec vitest run tests/vscode-stem.test.ts` passed 76 tests. Git-aware `node scripts/check-doc-budgets.mjs` and `git diff --check` passed in the real checkout. An initial suite run concurrent with packaging had five unchanged preview/schema parity failures; baseline `pnpm --filter vscode-stem exec vitest run tests/parity.test.ts -t 'excludes schema'` passed all nine selected cases, and the subsequent serial candidate suite passed. The transient failure's cause is not established.
- **Candidate inspection:** `pnpm --filter vscode-stem exec vsce package --no-dependencies --out C:\Users\Asus\AppData\Local\Temp\stem-r02-f9124e7a382842eb8611f3cc750b0a11\stem-r02-candidate.vsix` passed. Unpublished 0.4.0 candidate SHA-256: `F289B2682343E86729FA160732991BFE8A1795439115C144B7718A777639D084`; source identity is the baseline above plus this uncommitted six-file change. Seven ZIP entries: manifest/content types, extension manifest, bundled extension, README, changelog and license; no tests/source/fixtures. Separate envelopes, stdio and repair logic are present; engine remains `^1.101.0`. This candidate does not replace the previously audited release VSIX.
- **Host evidence / remaining acceptance:** A temporary extension-test harness loaded the extracted candidate with separate `--user-data-dir`, `--extensions-dir`, `--extensionDevelopmentPath` and `--extensionTestsPath`; npm was offline with a temporary cache. Cursor 2.3.41 (extension API 1.105.1) activated it and invoked the real setup command, producing both expected files. VS Code 1.126.0 activated it in an untrusted fixture and correctly wrote nothing; reading a copied candidate-generated configuration is not MCP recognition. Neither host supplied recognition evidence through the CodeLens probe. Native UI automation could not initialize, so trusted VS Code recognition, editor MCP listing/startup/tool use, home-global-source isolation, VS Code 1.101.x and remote checks remain unverified. No trust bypass, real editor configuration edit, MCP startup or publication was performed. Complete the [host checklist](packages/vscode-stem/CONTRIBUTING.md#mcp-validation) before accepting R02; keep R03 startup limitations separate.
- **Compatibility / rollback:** New extension release required. Existing generated configurations remain affected until explicitly repaired; publication alone cannot fix them. Revert scoped code/docs; configuration restoration requires a saved original and is separate from code rollback.

### R03: Resolve the configured or installed CLI without relying on version

- **Classification / priority / state:** Confirmed defect plus bounded Windows invocation verification; P2. Done; distribution candidate verified, publication pending R10. Medium; executable quoting/platform behavior is the main risk. On 10 October 2026 the owner reaffirmed deferral of historical core spec claims to the Pure Block Model migration, waived R00 for extension remediation, and explicitly approved the R03 implementation plan and validation. Remaining R00 governance decisions stay open.
- **Evidence / baseline:** A03a/A03b/A05b; baseline `9ea33f3b0a8f1ff6014dcd5be8871bcca0273893` probes unsupported `--version` and ignores `stem.cliPath` during MCP setup. Published CLI 0.3.0 has no version flag; R03 uses its supported `--help` instead.
- **Scope / change:** Seven files: extension `extension.js`, `package.json` setting description, `tests/vscode-stem.test.ts`, CLI-resolution sections of extension `README.md`/`CONTRIBUTING.md`, this R03 record/execution table, and `docs/status.md`. `tests/setup.ts` needed no change. Explicit executable/JavaScript paths (including workspace-relative paths and PATH command names) are validated before writes; failures notify without fallback. Otherwise discovery probes PATH candidates and uses npx only when none works. Native executables run directly; JavaScript entries use Node with Electron Node mode when needed; Windows shims use `cmd.exe /d /v:off /c` and a quoted path in `STEM_MCP_CLI`, preserving spaces and literal shell metacharacters. Existing valid MCP entries retain R02 preservation behavior; setting changes and regeneration are explained in the [usage guide](packages/vscode-stem/README.md#ai-context-server-mcp).
- **Exclusions:** No new CLI version flag, repository-relative fallback restoration, or CLI-driven preview.
- **Dependencies / position:** Owner waiver/plan approval recorded above; R02 source is already present. Independent of R09. Bundled-core preview remains in process.
- **Acceptance:** Valid explicit paths take effect; invalid explicit paths receive clear feedback; arguments and paths with spaces survive; PATH detection works with current published CLI; fallback occurs only under documented conditions. Windows `.cmd` behavior is verified, not assumed; distinguish mocks from actual Windows/POSIX evidence.
- **Validation (10 October 2026):** Windows x64 / Node 26.7.0 / pinned pnpm 11.2.2. Isolated tracked-file copy at `C:\Users\Asus\AppData\Local\Temp\stem-r03-9858d2bb87204a0592fbb39cb6ccf10a`, with existing dependency junctions and no install; set `$env:pnpm_config_verify_deps_before_run = 'false'` only for temporary-copy commands. Passed `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (715 tests / 42 suites: core 288, CLI 267, extension 160), `pnpm depcruise` (167 modules / 564 dependencies), and `pnpm --filter @stemdev/cli smoke:built-cli`. The command suite includes real JS, Windows `.cmd`/`.bat` and spaced `.exe` launch checks; the native `.exe` fixture is a copied Node executable, not a native Stem distribution. The initial lint run included two temporary experiment scripts at the copy root; moving them into ignored `.temp` and rerunning the exact lint command passed. In the real checkout, `node scripts/check-doc-budgets.mjs` passed 12 files and `git diff --check` passed; scope/protected-file review passed.
- **Published-CLI compatibility:** `node .temp/real-cli.cjs` in the isolated copy exercised the setup command with mocked editor APIs and actual child processes. Reused the retained exact-version `@stemdev/cli` 0.3.0 consumer from the 8 October audit (`stem-audit-20261008-af9da6c2/consumer`), exposed through a temporary junction whose path contains spaces, `&`, literal `%PATH%` and `!`; no registry operation was performed. Absolute JS, relative JS, explicit published `.cmd` shim, and PATH-discovered published shim all passed `--help`, generated matching host-specific entries, then completed MCP initialization and tool discovery through those entries without substitutions. Invalid explicit paths notified with zero configuration writes; empty PATH produced the exact npx fallback without executing/downloading it. Results are saved in `real-cli-results.json` under the isolated copy.
- **Candidate inspection:** `pnpm --filter vscode-stem exec vsce package --no-dependencies --out C:\Users\Asus\AppData\Local\Temp\stem-r03-9858d2bb87204a0592fbb39cb6ccf10a\stem-r03-candidate.vsix` passed. Unpublished 0.4.0 candidate SHA-256: `E154143C7DEEEDF2FF57D730AB22BE8B3BB66C5F4A630FD903B383D3EB2652FD`; source identity is the baseline above plus this uncommitted seven-file change. Seven ZIP entries; `./dist/extension.js` matches the tested bundle, contains the supported probe and bundled-core preview, and has no `--version` probe. Manifest setting/README describe discovery; engine remains `^1.101.0`; source/tests/maps/dependencies are excluded. VSCE emitted npm environment and bundle-size notices, with no packaging error. Inspection is saved in `vsix-inspection.json` under the isolated copy.
- **Limits / release:** Actual Windows process checks passed; no native POSIX, macOS, remote extension host, or real editor MCP UI/startup validation was performed for R03. Mocked editor APIs plus real MCP processes verify discovery/serialization/launch, not editor recognition; R01/R02 host acceptance remains separate. No release, publication, dependency change, or real user MCP configuration edit occurred. Consumer delivery requires R10.
- **Compatibility / rollback:** Extension-only release supports existing CLI 0.3.0. No CLI API change. Revert scoped code/docs; any generated user configuration may require independent restoration.

### R04: Correct CLI runtime dependency ownership

- **Classification / priority / state:** Maintainability improvement; P2 because consumer dependency ownership should reflect actual runtime use. Proposed; distribution pending. Small; low risk with packed-consumer checks.
- **Evidence:** A04a; direct production dependencies in `packages/cli/package.json`: `remark` and `unist-util-visit` serve `spike/parser-spike.ts`; direct `unified` use was not found in maintained runtime source.
- **Scope / change:** `packages/cli/package.json` and `pnpm-lock.yaml`. Move spike-only dependencies to devDependencies and remove the unused direct `unified` declaration after rechecking imports.
- **Exclusions:** No spike move/deletion, gray-matter/fast-glob replacement, general dependency upgrade, or claim that transitive packages disappear.
- **Dependencies / position:** R00 disposition; can follow the editor release checkpoint.
- **Acceptance:** Spike tooling remains typecheckable; all runtime imports are declared or intentionally bundled; packed CLI metadata has the intended ownership; clean consumers work without devDependencies or workspace links.
- **Validation:** Code profile and CLI packaging profile; inspect the exact packed dependency manifest and clean npm/pnpm installs.
- **Compatibility / rollback:** No intended API/CLI behavior change; installed consumers benefit only after a CLI release. Revert manifest and lockfile together, with task documentation; published metadata requires a corrective release.

### R05: Determine the smallest justified advisory remediation

- **Classification / priority / state:** Needs verification; P2 because advisory exposure is established but exploitability and a safe remedy are not. Proposed; distribution not applicable to this investigation. Medium; avoid equating dependency presence with demonstrated exploitation.
- **Evidence:** A04b; [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) in published consumer dependency chains. Eight reported nodes are not eight independent vulnerabilities.
- **Scope / change:** Read CLI finder, rename, render operations and their tests; audit a clean exact-version consumer. Write conclusions and a separately proposed remedy here/status. For each chain, identify affected input paths, reachability, parity constraints, and the smallest supported remedy or bounded remaining uncertainty.
- **Exclusions:** No dependency upgrade/replacement, core-private import/export, publication, or assumption that gray-matter/fast-glob replacement is already approved.
- **Dependencies / position:** None; may run earlier. R04 is not required and does not by itself resolve these chains.
- **Acceptance:** Each advisory has exact resolved versions, chain/reachability evidence, disposition, and either a justified follow-on scope with parity checks or a reason no change is needed. Any required ADR is identified before implementation.
- **Validation:** `npm audit --omit=dev --json` in the clean consumer; source tracing and safe reproductions where needed. Define additional exact reproduction commands only after identifying the relevant input; none are presumed here.
- **Compatibility / rollback:** Investigation completion does not close published exposure. Any source replacement and release needs separate approval. Correct/revert conclusions if disproved while retaining supporting evidence.

### R06: Align existing repository guidance with the released architecture

- **Classification / priority / state:** Maintainability improvement; P2 because obsolete instructions misdirect contributors and consumers. Proposed; distribution pending only for packaged README changes. Medium; scope must remain documentary.
- **Evidence:** A05a/A07d/A08; root guidance still describes two packages, obsolete architecture links/commands, the MCP roadmap checkbox, and CLI type boundaries predating extraction. Existing released exports are the baseline, not an invitation to restore removed types.
- **Scope / change:** Root `README.md`, `CONTRIBUTING.md`, `docs/architecture.md`, `packages/cli/README.md`, and the product roadmap section above. Correct three-package discovery, supported commands/links, completed MCP implementation status, ESM/public import examples, and extraction-related type guidance. Add core discovery/examples within existing documents. Architecture corrections must reflect accepted ADRs; link those decisions rather than inventing architecture.
- **Exclusions:** No protected instruction edit, ADR acceptance, new README/document, generated API edit, compatibility wrapper, or duplicate extension-guide rewrite.
- **Dependencies / position:** Relevant R00 policy decisions. Does not block the consumer fixes; unresolved decisions must not be silently described as accepted.
- **Acceptance:** Referenced paths and commands match current manifests; no promise of old CLI domain/config exports remains; examples use public package entries and work in clean consumers; docs explain the accepted architecture without altering it.
- **Validation:** Documentation profile, command/manifest comparison, and exact example checks in clean consumers. Record the commands used for examples at execution.
- **Compatibility / rollback:** No runtime/API change. Repository guidance takes effect in Git; packaged CLI README corrections need release. Revert only scoped prose if inaccurate.

### R07: Regenerate the CLI API reference

- **Classification / priority / state:** Maintainability improvement; P2 because the checked-in reference disagrees with the released declarations. Proposed; distribution not applicable. Small; tool-version warnings must not trigger unsolicited upgrades.
- **Evidence:** A05c/A08; `packages/cli/docs/stem-api.d.ts` includes pre-extraction declarations (audit references near lines 11 and 315 onward), while published declarations passed consumer checks.
- **Scope / change:** Regenerate only `packages/cli/docs/stem-api.d.ts` using its existing API Extractor configuration, plus task/status records.
- **Exclusions:** No hand-editing generated declarations, export change, tool upgrade, configuration rewrite, or other generated artifact update.
- **Dependencies / position:** None; use the current approved source baseline.
- **Acceptance:** Reference reflects the current public CLI entry/core type imports; a second generation produces identical output; no source or public API change is hidden in the diff.
- **Validation:** `pnpm --filter @stemdev/core build`; `pnpm --filter @stemdev/cli docs:types`; `pnpm --filter @stemdev/cli typecheck`; run `docs:types` again and compare output; documentation profile. Record API Extractor's TypeScript 5.9.3 versus project 6.0.3 warning if still present; do not upgrade to suppress it.
- **Compatibility / rollback:** Generated documentation only; revert that file and task/status updates. No publication required for the repository reference.

### R08: Correct the packaged extension contribution link

- **Classification / priority / state:** Confirmed documentation defect; P2 because extension contributors are sent to the wrong guide. Proposed; distribution pending. Small; low risk.
- **Evidence:** A07c; published VSIX README contribution link resolves to root `CONTRIBUTING.md`. Planning inspection of installed VSCE `out/package.js`, `guessBaseUrls()` around line 703, found it uses repository URL/branch and not `repository.directory`; D02 alone is not this fix.
- **Scope / change:** `packages/vscode-stem/README.md` contribution link. Use an explicit repository URL targeting the existing extension guide.
- **Exclusions:** No repository metadata change, release-workflow edit, or broader guide rewrite.
- **Dependencies / position:** No technical prerequisite; schedule after R01/R03 guide corrections where practical.
- **Acceptance:** Both repository Markdown and packaged `extension/readme.md` lead to the existing extension-specific guide; verify the target path.
- **Validation:** Documentation profile and VSIX packaging/README inspection; no runtime tests needed solely for this link change.
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

- **Classification / priority / state:** Needs verification; P1 because affected consumers still have defects after source-only fixes. Proposed; distribution pending explicit release authorization. Medium; irreversible distribution requires a concrete candidate.
- **Evidence:** A09 and the baseline source/artifact comparison. A Git commit/tag does not demonstrate consumers received a corrected artifact.
- **Scope / change:** For each invocation, select only completed source tasks, exact package/version candidates, release source SHA, and intended channel; inspect candidate tarballs/VSIX, release PR metadata, and clean consumers. Record evidence and update the selected tasks' distribution status here. A release PR may change existing package manifests/CHANGELOGs and `.release-please-manifest.json`; approve that concrete file diff separately before any release action.
- **Exclusions:** No requirement to finish unrelated backlog tasks, no unapproved registry operation, and no assumption that a GitHub VSIX release proves Marketplace publication.
- **Dependencies / position:** Selected source tasks pass acceptance; explicit release approval. Reusable checkpoint after editor fixes and later CLI changes. Merging to a publishing branch may trigger publication and requires release authorization.
- **Acceptance:** Record exact versions/source SHA, candidate contents, correct rewritten workspace ranges/core-first ordering, then download the actual authorized published versions and repeat relevant reproductions/clean-consumer checks. Set published verified only for the intended channel and exact artifact. Track each invocation separately; tests on HEAD are insufficient.
- **Validation:** As applicable, `node scripts/check-packed-core.mjs <core-tarball-path>` and `node scripts/verify-release-tarball.mjs <cli-tarball-path> --check-registry`; clean exact-version npm/pnpm imports, TypeScript declarations and CLI smoke; extension bundle/assets and real-host checks. Exact install/publish commands and versions cannot be selected before the candidate exists; record them in the release approval and evidence.
- **Compatibility / rollback:** Preserve npm names, public entries, `stem` executable, and extension identity. Before publication, abandon/revert the candidate; after publication, use a corrective release. Do not promise overwrite/unpublish rollback or automatic restoration of user configuration.

### Deferred and rejected suggestions

| ID  | Suggestion / classification                                                                 | Disposition and reason                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Remove tracked install-npm consumer residue; optional P3                                    | Deferred until its example value is confirmed. Potential scope is only its `.gitignore`, `.stem/config.json`, `blocks/schemas/adr.yaml`, `blocks/schemas/api.yaml`, `blocks/smoke-block.md`, `views/smoke-view.md`, `package.json`, and `package-lock.json`; no deletion approved.                                                           |
| D02 | Add package repository.directory fields; optional P3                                        | Useful monorepo metadata, independently deferrable. Does not fix VSCE's contribution-link rewriting; R08 handles that root cause.                                                                                                                                                                                                            |
| D03 | Add a core README; optional                                                                 | Deferred because a new document needs explicit authorization/governance handling. R06 improves discovery through existing documents first.                                                                                                                                                                                                   |
| D04 | Consolidate filesystem operation types/duplicates; optional P3                              | No demonstrated behavior defect; keep CLI-specific internal types until a concrete maintenance benefit justifies scope.                                                                                                                                                                                                                      |
| D05 | Split MCP into a new package or generic abstraction                                         | Rejected for this backlog: no separate consumer/runtime/release boundary demonstrated; new packages are prohibited.                                                                                                                                                                                                                          |
| D06 | Remove legacy extension helpers or typecheck its JavaScript entry; maintenance candidate P2 | Deferred pending usage/test inventory. Loader/tests are checked, legacy CommonJS entry is not typechecked and is ESLint-ignored. Avoid incidental removal during R01-R03.                                                                                                                                                                    |
| D07 | Shared namespace loader, local external snapshot producer, stricter fetchedAt               | Deferred pending namespace/snapshot ADR; see [remaining namespace issues](docs/status.md#remaining-namespace-issues). [ADR-0004](docs/decisions/0004-core-schema-and-snapshot-decoders.md) preserves decoder behavior. Do not treat external/internal snapshot names as a typo.                                                              |
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
