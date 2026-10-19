# Stem

Git-native, Markdown-based documentation tool. Core model: **Block** and **Tag** only.
Monorepo (pnpm): `packages/core` (@stemdev/core), `packages/cli` (@stemdev/cli), `packages/vscode-stem` (vscode-stem).
Package-specific commands and boundaries live in each package's `AGENTS.md`.

## Authority Hierarchy (higher wins on conflict)

axioms > governance > rules > accepted ADRs > accepted specifications > architecture > status
Conflict between task and authority: stop and ask. Never resolve silently.

## Read Order

1. `docs/axioms.md` — always. Invariants, ≤10 lines. Never contradict.
2. `docs/rules.md` — always. One testable line per rule, all binding.
3. `docs/status.md` — for current work, active backlog, and known limits.
4. `docs/architecture.md`, `docs/decisions/`, and relevant `docs/specs/` — when touching system design, behavior, or APIs.
5. Nested `AGENTS.md` — in the package directory you are modifying.
6. Creating/changing docs, rules, or ADRs: use the `stem-docs` skill.

## Commands (run from repo root)

- install: `pnpm install --frozen-lockfile`
- build all: `pnpm build`
- test all: `pnpm test`
- lint all: `pnpm lint`
- typecheck all: `pnpm typecheck`
- dependency boundaries: `pnpm depcruise`
- doc line budgets: `node scripts/check-doc-budgets.mjs`
- full verification profile:
  `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm depcruise && pnpm --filter @stemdev/cli smoke:built-cli && node scripts/check-doc-budgets.mjs && git diff --check`

## Hard Constraints

- Human-owned files: do NOT edit `AGENTS.md`, `docs/axioms.md`, `docs/governance.md`. Propose changes in your reply instead.
- Plan first, obtain approval, then edit. Stay strictly inside files named in the task.
- Package boundaries: never import another package's `src/`; use public exports.
- Proposed ADRs may be drafted for review; other new docs, top-level files, packages, or primitives require an accepted ADR.
- Update `docs/status.md` in the same change as code (keep ≤60 lines; prune resolved items).
- Do not restate content that lives elsewhere; link to it. Single source of truth.
- Git: never stage, commit, tag, or push automatically unless explicitly instructed.
