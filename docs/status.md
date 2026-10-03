# Status

Agent-editable. Budget: 60 lines. Delete items when resolved.

## Open spec bugs (resolve before further implementation)

- `resolveBlockSelection()` returns array for tag refs; substitution site expects string; no merge rule for duplicate tags under warning.
- `GraphEdge.to` typed as local node id; namespace refs target nodes never in local `nodes` map.
- "tags" used in three senses (frontmatter labels, `@stem[tag:name]` fragments, `StemSection.tags`). Proposed: rename frontmatter field to `labels`.

## Open policy

- Transclusion depth and cycle-warning: soft-warning threshold and configurability undecided.

## In progress: core extraction (ADR-0001)

- Six steps, one Codex session each. Step 1 (baseline) is next.

## Known issues

- `.vscode/launch.json` points to `extensions/vscode-stem`; the extension lives at `packages/vscode-stem`. (Confirm in step 1.)
- Possible bug: external loading expects `.stem/cache/stem-graph.json`; sync writes `graph.json`; nothing visibly produces the external format. Blocks any shared namespace loader.
- `@stem/types` is a tsconfig path alias, not a package; removed during core extraction.
- Local wrapper folder `stemdev-hub/` is outside git and holds nothing; the repo root is the former `cli/`.

## Before first core release

- Confirm npm publish permissions for `@stemdev/core` (token or trusted publisher). Publish core before any CLI that depends on it.
