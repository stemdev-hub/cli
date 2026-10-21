# Rules

One testable line per rule. Changing a rule needs an accepted ADR.

## Package boundaries

- `@stemdev/core` imports no Node built-ins, no process/Buffer/fetch/console, and no CLI/MCP/editor code (ADR-0001).
- `@stemdev/core` takes time as an input (`nowMs`); it never reads the clock (ADR-0001).
- No package imports another package's `src/`; use its public entry (ADR-0001).
- `@stemdev/core` exports only through `src/index.ts`; removals, renames, and architecturally significant public API changes require an accepted ADR (ADR-0001, ADR-0008).
- Frontmatter follows the schema, engine and normalization policy in ADR-0002.
- Tag-schema YAML and cached external-snapshot envelopes are decoded through core's public pure decoders; consumers own I/O, paths, fallback policy, timestamps and contextual errors (ADR-0004).
