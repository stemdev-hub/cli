# October 2026 Pure Block checkpoints

Historical evidence, not implementation instructions or renewed authorization. [Roadmap](../../roadmap.md#pure-block-migration)
owns current work; [architecture](../architecture.md#current-decision-applicability) routes to governing
decisions and specifications. This record retains acceptance provenance and verification limits;
completed file lists, repeated contracts and routine execution narration are omitted.

## Acceptance and scope

| Date       | Checkpoint               | Evidence and scope                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 23 October | Product design           | Owner accepted ADR-0005, ADR-0007 and all four specifications at `a56203e`, retaining open mechanics and deferred work. Acceptance/supersession bookkeeping was committed in `ea7584a`, including the owner's protected core-instruction update. Earlier proposal reviews did not themselves establish acceptance. |
| 24 October | Implementation direction | Owner retained durable project identity and required useful CLI/MCP/editor workflows during coordinated replacement, superseding a chat proposal to withdraw commands and preview. Identity precedes connection checks and producer-owned publication, not pure parsing.                                           |
| 24 October | Parser/model contracts   | Five-document checkpoint approved against `d775326`, committed as `0632938`: four specifications and roadmap. The pending core inventory remains in the roadmap; dependent adapter scopes were not approved by this checkpoint.                                                                                    |
| 24 October | Shared writer            | Four-file implementation approved against `0632938`, committed as `cdd1389`: CLI writer, its tests, architecture and roadmap. No output ownership or locking implementation was included.                                                                                                                          |
| 24 October | Composition/adapters     | Five contract recommendations approved against `cdd1389`, committed as `72b3862`: composition specification and roadmap. Concrete adapter declarations and coordinated runtime replacement remained pending.                                                                                                       |
| 25 October | Project identity         | Owner approved the four-document checkpoint against `72b3862`, including removal of config `version`: connection specification, ADR-0010, architecture and roadmap. Documentation committed as `32fbf66`; a subsequent instruction authorized the recorded runtime inventory, completed in `225fdc8`.              |
| 25 October | Publication bookkeeping  | Owner approved manifest encoding and local coordination recommendations after `225fdc8`, limited to composition specification and roadmap. This was documentation approval, not authorization for runtime publication or cleanup.                                                                                  |

ADR-0010 records the identity API decision; the specifications own the accepted behavioral details.
The schema-retirement refinement applied generic unknown-key validation rather than retired-field
lookups. Its owner approval and implementation on 24 October are represented by `d775326`.

## Verification evidence

These are the recorded checks for the named checkpoints, not fresh checks of a later checkout.
The full workspace profile means the checks listed in [CONTRIBUTING](../../CONTRIBUTING.md#verification).
No checkpoint below established clean installed-consumer, real editor-host or registry/Marketplace
acceptance. Local artifacts must not be treated as release evidence.

| Checkpoint                                    | Recorded result                                                                                                                                                                    | Qualifications                                                                                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared cycle tracking, `635e833` (24 October) | Build, typecheck, lint, dependency boundaries, built-CLI smoke, documentation and whitespace checks passed; 294 core, 267 CLI and 160 editor tests.                                | Sandbox access failures and integration timeouts passed on isolated unrestricted reruns; test limits were unchanged.                                                                                                                         |
| Tag-schema retirement, `d775326` (24 October) | Windows, Node 26.12.1, pnpm 11.25.0: workspace profile passed; 280 core, 247 CLI, 155 editor and 11 documentation tests. Local core/CLI package checks and VSIX inspection passed. | Earlier sandbox-access and concurrent-rebuild failures were resolved before passing checks.                                                                                                                                                  |
| Shared writer, `cdd1389` (24 October)         | Same Windows/tool versions: workspace checks, final writer suite, targeted lint and CLI typecheck passed.                                                                          | Full CLI run passed 256 of 257 tests with one fixture-write `EPERM`; all 22 tests in that file passed unrestricted. Concurrent-replacement test ordering was made deterministic because Windows may reject simultaneous replacement renames. |
| Identity, `225fdc8` (25 October)              | Same Windows/tool versions: workspace profile passed; 309 core, 276 CLI, 163 editor and 11 documentation tests. Local core/CLI packages and VSIX inspection passed.                | API Extractor's compiler-version warning remained nonfatal. Identity preservation, concurrent creation, failure/retry and read-time nonmutation had targeted coverage.                                                                       |

Schema and identity artifact checks covered core 0.1.0, CLI 0.3.1 and extension 0.4.1: core publint
and ESM declaration resolution, package dependency specifiers, and VSIX bundle/exclusions. Those
versions identify the local candidates, not uniquely reproducible binaries or published delivery.

The parser/model (`0632938`), composition (`72b3862`), identity (`32fbf66`) and 25 October publication
documentation checkpoints passed static documentation, budget and whitespace checks. Runtime and
artifact tests were not evidence claimed for those documentation-only changes.
