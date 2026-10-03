# Status

Agent-editable. Budget: 60 lines. Delete items when resolved.

## Open spec bugs (resolve before further implementation)

- `resolveBlockSelection()` returns array for tag refs; substitution site expects string; no merge rule for duplicate tags under warning.
- `GraphEdge.to` typed as local node id; namespace refs target nodes never in local `nodes` map.
- "tags" used in three senses (frontmatter labels, `@stem[tag:name]` fragments, `StemSection.tags`). Proposed: rename frontmatter field to `labels`.

## Open policy

- Transclusion depth and cycle-warning: soft-warning threshold and configurability undecided.

## In progress: core extraction (ADR-0001)

- Six steps, one Codex session each. Step 1 (baseline): fixes applied; smoke and VSIX contents await re-verification.
- Baseline run by the user outside the sandbox: install, typecheck, lint, test (34 files / 373 tests), build, and vsce package all EXIT 0.
- smoke:built-cli FAILED: ".stem/cache/index.json expected version 1, got 2" (tests/smoke/built-cli-smoke.mjs:111, called at line 51). Stale index expectation corrected to source CACHE_VERSION '2'; graph expectation matches GRAPH_SNAPSHOT_VERSION '1'. Rerun pending.
- VSIX packaging succeeded but included extension/AGENTS.md; AGENTS.md added to .vscodeignore. Package contents re-verification pending.
- lint: 2 unused-eslint-disable warnings in packages/cli/tests/mcp/setup.test.ts
- CI does not run the built-CLI smoke script; add it in step 6 (the smoke was stale)

## Known issues

- External graph format: `.stem/cache/stem-graph.json` (ExternalStemGraph) is a different artifact from sync's `graph.json` (internal GraphSnapshot); not a filename bug. Gap: only `publishGraph()` produces the external format and it does not save it locally, so local-only namespace use has no producer. Decide via ADR before building a shared namespace loader.
- vscode-stem has no build/test/typecheck scripts; its tests live in packages/cli/tests/extensions; eslint ignores extension JS, so recursive checks do not cover the extension.
- `@stem/types` is a tsconfig path alias, not a package; removed during core extraction.
- Local wrapper folder `stemdev-hub/` is outside git and holds nothing; the repo root is the former `cli/`.

## Before first core release

- Confirm npm publish permissions for `@stemdev/core` (token or trusted publisher). Publish core before any CLI that depends on it.
