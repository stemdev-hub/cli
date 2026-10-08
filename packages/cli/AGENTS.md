# packages/cli (@stemdev/cli)

- build: `pnpm --filter @stemdev/cli build`
- test: `pnpm --filter @stemdev/cli test`
- typecheck: `pnpm --filter @stemdev/cli typecheck`
- built-CLI smoke (run after build): `pnpm --filter @stemdev/cli smoke:built-cli`
- lint: no package script; use root `pnpm lint`

Run build, test, typecheck, and smoke before calling a change done.
Being restructured per ADR-0001 (domain logic moves to packages/core). Do not move code between packages unless the task says so.
