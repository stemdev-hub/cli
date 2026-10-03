# Stem

Git-native, Markdown-based documentation tool. Core model: **Block** and **Tag** only.
Monorepo (pnpm): `packages/cli`, `packages/vscode-stem`. `packages/core` is planned (ADR-0001).
Package-specific commands live in each package's `AGENTS.md`.

## Commands (run from the repo root)

- install: `pnpm install --frozen-lockfile`
- build all: `pnpm build`
- test all: `pnpm test`
- lint: `pnpm lint`
- typecheck: `pnpm typecheck`

## Read order

1. `docs/axioms.md` — always. Never contradict.
2. `docs/rules.md` — always. One line per rule, all binding.
3. `docs/status.md` — for current work.
4. `docs/architecture.md`, `docs/decisions/` — when the task touches design.
5. Nested `AGENTS.md` files on the path to the directory you are working in.
6. Creating/changing docs, rules, or ADRs: use the `stem-docs` skill.

## Hard constraints

- Do not edit any `AGENTS.md`, `docs/axioms.md`, `docs/governance.md`. Propose changes in your reply instead.
- Axiom/rule/ADR conflict with the task: stop and ask. Do not resolve silently.
- Plan first, get approval, then edit. Stay inside the files named in the task.
- Do not create new docs, top-level files, packages, or primitives.
- Update `docs/status.md` in the same change as the code.
- Do not restate content that lives elsewhere; link to it.
