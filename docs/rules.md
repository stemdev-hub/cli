# Rules

One testable line per rule. Changing a rule needs an accepted ADR.

## Package boundaries

- `@stemdev/core` imports no Node built-ins, no process/Buffer/fetch/console, and no CLI/MCP/editor code (ADR-0001).
- `@stemdev/core` takes time as an input (`nowMs`); it never reads the clock (ADR-0001).
- No package imports another package's `src/`; use its public entry (ADR-0001).
- `@stemdev/core` public API changes need an ADR; export only through `src/index.ts` (ADR-0001).
- Frontmatter follows the schema, engine and normalization policy in ADR-0002.
