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
- Step 3 Phase A: core package skeleton added; dependency installation and Phase B extraction pending. Config lint cannot resolve tsdown until installation; build, tests, and package gates remain unverified.
- VSIX packaging succeeded but included extension/AGENTS.md; AGENTS.md added to .vscodeignore. Package contents re-verification pending.
- CI does not run the built-CLI smoke script; add it in step 6 (the smoke was stale)

## Known issues

- External graph format: `.stem/cache/stem-graph.json` (ExternalStemGraph) is a different artifact from sync's `graph.json` (internal GraphSnapshot); not a filename bug. Gap: only `publishGraph()` produces the external format and it does not save it locally, so local-only namespace use has no producer. Decide via ADR before building a shared namespace loader.
- vscode-stem has no build/test/typecheck scripts; its tests live in packages/cli/tests/extensions; eslint ignores extension JS, so recursive checks do not cover the extension.
- `@stem/types` is a tsconfig path alias, not a package; removed during core extraction.
- Local wrapper folder `stemdev-hub/` is outside git and holds nothing; the repo root is the former `cli/`.

## Before first core release

- Confirm npm publish permissions for `@stemdev/core` (token or trusted publisher). Publish core before any CLI that depends on it.
