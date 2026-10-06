# Status

Agent-editable. Budget: 60 lines. Delete items when resolved.

## Open spec bugs (resolve before further implementation)

- `resolveBlockSelection()` returns array for tag refs; substitution site expects string; no merge rule for duplicate tags under warning.
- `GraphEdge.to` typed as local node id; namespace refs target nodes never in local `nodes` map.
- "tags" used in three senses (frontmatter labels, `@stem[tag:name]` fragments, `StemSection.tags`). Proposed: rename frontmatter field to `labels`.

## Open policy

- Transclusion depth and cycle-warning: soft-warning threshold and configurability undecided.

## In progress: core extraction (ADR-0001)

- Six steps, one Codex session each. Step 1 (baseline): built-CLI smoke reverified; VSIX contents still await re-verification.
- Baseline run by the user outside the sandbox: install, typecheck, lint, test (34 files / 373 tests), build, and vsce package all EXIT 0.
- Step 2: parser portability, explicit validator time, and config split implemented in place; YAML policy is [proposed ADR-0002](decisions/0002-frontmatter-yaml-core-schema.md).
- Step 2 final verification via Node: typecheck, lint, full suite (35 files / 438 tests, including portability), build, built-CLI smoke, and `git diff --check` passed. Gray-matter characterization passed before replacement (4 files / 64 tests).
- Portability smoke uses browser platform with native worker exports, no polyfills, and in-memory output. Sandbox denied esbuild directory access; approved runs outside the sandbox passed.
- Gray-matter remains in Node rename/render operations; it must not be used in anything moved to core ([ADR-0001](decisions/0001-extract-core-package.md)).
- Step 3: portable modules/tests extracted to core; persistence/operation/resolved-config types stay in CLI runtime ([ADR-0001](decisions/0001-extract-core-package.md)). CLI test/typecheck scripts build core first; tsup leaves core external.
- Step 3 verification: core build/typecheck, 194 core tests (portability rerun outside sandbox), CLI typecheck, repo lint, 244 CLI tests, build, and built-CLI smoke passed. Existing test bodies/expectations preserved.
- User ran install and pnpm pack. Packed manifests/files passed; core publint passed with a repository-URL suggestion, attw passed its ESM-only profile (Node 10/CommonJS findings remain). Clean external install of both tarballs, `stem init`, and ESM parser smoke passed.
- Step 3 gate exception: `stem --version` exits 1 (unknown option); the baseline CLI has no version flag. Preserved under the no-behavior-change constraint. Recursive script execution through pnpm remains unverified by the agent.
- Step 4: pure `analyzeProject(snapshot, options)` added; CLI loads snapshots and effect modules moved to runtime ([ADR-0001](decisions/0001-extract-core-package.md)).
- Step 4 verification: core build/typecheck and 209 tests (including portability), CLI typecheck, lint, 244 tests, build, help and built-CLI smoke passed. Portability needed approved execution outside the sandbox; fresh tarball checks and clean external pnpm installation remain unverified.
- Step 5 Phase A committed: core decoders and CLI loading policy verified ([ADR-0004](decisions/0004-core-schema-and-snapshot-decoders.md)); Phase B uses their public entry.
- Step 5 Phase B: preview uses bundled core with async VS Code loading, unsaved buffers, recursive discovery, debounced cancellation, and CLI diagnostic/display parity. Existing extension tests moved; only the authorized trust warning expectation changed.
- Phase B verification: core build/typecheck and 288 tests, CLI build/typecheck and 267 tests, extension build/typecheck and 78 tests, repo lint and CLI smoke passed. Metafile audit found no declared engine range incompatible with Node 22.15; real extension host remains unverified.
- Phase B VSIX content rule: include only dist/extension.js from dist/; exclude every other dist artifact, including extension.meta.json and bundled-engines.json. All of dist/ remains gitignored; source, tests, config and AGENTS.md exclusions are configured.
- Phase B packaging UNVERIFIED pending the user's pnpm run: VSCE file listing invoked through Node failed because @azure/core-client could not resolve tslib.
- Phase B symlink parity passed for file links, Windows directory junctions and broken links; cyclic links and native POSIX directory symlinks remain UNVERIFIED.
- VSIX packaging succeeded but included extension/AGENTS.md; AGENTS.md added to .vscodeignore. Package contents re-verification pending.
- CI does not run the built-CLI smoke script; add it in step 6 (the smoke was stale)

## Known issues

- External graph format: `.stem/cache/stem-graph.json` (ExternalStemGraph) is a different artifact from sync's `graph.json` (internal GraphSnapshot); not a filename bug. Gap: only `publishGraph()` produces the external format and it does not save it locally, so local-only namespace use has no producer. Decide via ADR before building a shared namespace loader.
- vscode-stem's loader and tests are typechecked/linted; its legacy CommonJS entry remains outside typechecking and is ignored by eslint.
- Local wrapper folder `stemdev-hub/` is outside git and holds nothing; the repo root is the former `cli/`.
- `stem --version` is not supported by the CLI; gates use `stem --help` instead. Add `--version` as a small separate task.
- External snapshot types exported from @stemdev/core are provisional until the namespace/snapshot ADR.
- Snapshot envelope fetchedAt is not validated as a date (kept for parity); revisit with the namespace ADR.
- MCP setup ignores stem.cliPath (bug); retained during extension core adoption.
- Namespace snapshot loading policy is duplicated between CLI and extension until the namespace ADR.
- CLI render still uses gray-matter to re-parse frontmatter; extension display uses the core-rendered body.
- `pnpm install` emits 24 deprecation warnings related to `@yuku-parser/binding-win32-x64` which is pulled in by `tsdown` (a devDependency of core). This is a known issue to revisit later and does not block development.

## Before first core release

- Confirm npm publish permissions for `@stemdev/core` (token or trusted publisher). Publish core before any CLI that depends on it.
