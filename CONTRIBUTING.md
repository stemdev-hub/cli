# Contributing to Stem

Stem is organized as a TypeScript Node.js CLI with a reusable core library. Please keep contributions small, typed, and aligned with the module boundaries below.

## Module Structure

- `src/cli/`: command registration and terminal output only.
- `src/core/fs/`: project discovery, file scanning, reads, and writes.
- `src/core/config/`: `.stem/config.json` loading, defaults, and config path normalization.
- `src/core/parser/`: frontmatter parsing, `@stem[]` parsing, and two-pass section/tag resolution.
- `src/core/graph/`: in-memory graph construction and traversal.
- `src/core/cache/`: cache index, graph snapshots, and hybrid stat plus SHA invalidation.
- `src/core/operations/`: orchestration for CLI commands.
- `src/core/validator/`: schema validation and structural rules.
- `src/core/types/`: shared type definitions only.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## Contribution Rules

- Keep the CLI as a thin shell over `src/core/operations/`.
- Do not introduce runtime imports from `src/cli/` into `src/core/`.
- Use `import type` for type-only imports across modules.
- Keep validation read-only.
- Never write the dynamic graph into source files; cache output belongs under `.stem/cache/`.
- Update `docs/decisions.md` whenever a major architecture or product decision changes.

## Commit Messages

Follow conventional commits:

- `feat:` - new feature or capability.
- `fix:` - bug fix.
- `chore:` - tooling, dependencies, or configuration.
- `docs:` - documentation only.
- `test:` - tests only.
- `refactor:` - code changes with no intended behavior change.

Keep messages short and specific. Reference the affected module when useful, for example `feat(parser): add two-pass section resolution`.

## Architecture and Module Rules

Stem is deliberately layered. Every module has one job and a narrow set of allowed dependencies. Treat these boundaries as part of the public design of the project: they make changes easier to test, review, and extend.

### The Layer Model

```text
┌─────────────────────────────────┐
│         CLI Layer               │  src/cli/commands/
│  (formats output, parses args)  │
└────────────────┬────────────────┘
                 │ calls
┌────────────────▼────────────────┐
│       Operations Layer          │  src/core/operations/
│  (orchestrates, coordinates)    │
└──┬──────┬──────┬──────┬─────┬──┘
   │      │      │      │     │ calls
┌──▼─┐ ┌──▼─┐ ┌─▼──┐ ┌─▼─┐ ┌▼───┐
│ fs │ │pars│ │grph│ │cch│ │vald│   src/core/{fs, parser, graph, cache, validator}
│    │ │er  │ │    │ │   │ │    │
└──┬─┘ └──┬─┘ └─┬──┘ └─┬─┘ └┬───┘
   │      │     │      │    │ imports
┌──▼──────▼─────▼──────▼────▼───┐
│           Types Layer          │  src/core/types/
│   (shared interfaces only)     │
└────────────────────────────────┘
```

### Dependency Rules

Allowed imports:

| From | May Import |
| --- | --- |
| `cli/commands/` | `core/operations/` only |
| `core/operations/` | `core/fs/`, `core/config/`, `core/parser/`, `core/graph/`, `core/cache/`, `core/validator/`, `core/types/` |
| `core/config/` | `core/fs/` and `core/types/` only |
| `core/parser/` | Sibling files within `core/parser/`, `core/types/`, and approved external parser libraries only |
| `core/graph/` | `core/types/` only |
| `core/cache/` | `core/fs/` and `core/types/` only |
| `core/validator/` | `core/types/` only |
| `core/fs/` | `core/types/` only |
| `core/types/` | Sibling files within `core/types/` using `import type`; type-only imports from external packages where needed |
| `src/index.ts` | `core/config/`, `core/operations/`, and `core/types/` only, as the public API export |

Forbidden imports:

- Never let `parser` import from `graph`, `cache`, or `validator`.
- Never let modules other than `core/config/` load `.stem/config.json`; other modules receive `ResolvedStemConfig` as input.
- Parser files may import sibling parser helpers, but parser behavior must remain independent of file scanning, graph construction, cache persistence, validation orchestration, and CLI formatting.
- Never let `graph` import from `parser` or `cache`.
- Never let `cache` import from `validator` or `graph`.
- Never let `cli/commands/` import directly from `core/parser/`, `core/graph/`, `core/cache/`, or `core/validator/`; commands must go through `core/operations/`.
- Never import anything from `cli/` into another module.
- Never let `core/types/` import from another internal layer or contain runtime imports.
- Never introduce circular imports of any kind.

### Single Responsibility Rules

#### `core/fs/`

- ✅ Finding project root by walking up directory tree
- ✅ Scanning `/blocks` and `/views` folders
- ✅ Reading file content and file stats
- ✅ Writing files safely (atomic writes)
- ❌ Never parses content
- ❌ Never builds graphs
- ❌ Never validates anything

#### `core/config/`

- ✅ Loads `.stem/config.json`
- ✅ Applies default config values
- ✅ Normalizes config paths to project-relative POSIX paths
- ✅ Rejects unsupported config versions and unsafe paths
- ❌ Never parses Markdown content
- ❌ Never scans block or view files
- ❌ Never builds graphs or validates documentation content

#### `core/parser/`

- ✅ Takes a file content string as input
- ✅ Extracts YAML frontmatter
- ✅ Parses `@stem[]` syntax into AST nodes
- ✅ Resolves section/tag relationships via two-pass algorithm
- ✅ Returns typed `ParsedBlock` or `ParsedView` objects
- ✅ Depends on `unist-util-visit` as a direct runtime dependency for Remark AST traversal
- ❌ Never reads files itself - receives content as string input
- ❌ Never writes files
- ❌ Never knows about the graph or cache

MVP syntax constraints are intentional:

- `@stem[]` references are always single-line
- Parameter values cannot contain `]`, spaces, or special characters
- Both constraints can be lifted post-MVP if the parser migrates to a micromark extension

#### `core/graph/`

- ✅ Takes parsed file data as input
- ✅ Builds the in-memory connection graph
- ✅ Traverses the graph for dependency resolution
- ✅ Detects cycles using visited-set depth-first search
- ❌ Never reads files
- ❌ Never writes files
- ❌ Never validates schema rules

#### `core/cache/`

- ✅ Reads and writes `/.stem/cache/index.json` and `graph.json`
- ✅ Implements hybrid stat+SHA cache invalidation logic
- ✅ Determines which files need re-parsing
- ✅ Converts parsed blocks/views into serializable cached records
- ❌ Never parses files
- ❌ Never builds graphs
- ❌ Never validates anything
- ❌ Never contains business logic

#### `core/validator/`

- ✅ Takes a graph as input
- ✅ Returns a list of validation issues
- ✅ Checks all validation rules (duplicate IDs, broken refs, schema violations, etc.)
- ❌ Never reads or writes files
- ❌ Never modifies the graph
- ❌ No side effects of any kind - pure input -> output function

#### `core/operations/`

- ✅ The only layer that coordinates multiple core modules together
- ✅ Orchestrates the full data flow for each CLI command
- ✅ Calls fs -> parser -> graph -> cache -> validator in the right order
- ❌ Never contains low-level implementation details
- ❌ Never directly reads files (delegates to fs)
- ❌ Never directly parses content (delegates to parser)

#### `cli/commands/`

- ✅ Parses CLI arguments and options
- ✅ Calls the corresponding operation
- ✅ Formats the operation result for terminal output
- ✅ Sets process exit codes
- ❌ Never contains business logic
- ❌ Never calls core modules directly - always through operations
- ❌ Never formats error messages from raw strings - always formats typed result objects

#### `core/types/`

- ✅ Defines all shared TypeScript interfaces
- ✅ Exports everything through `index.ts` using `export type`
- ✅ All cross-file imports within `core/types/` use `import type`
- ❌ Never contains runtime logic
- ❌ Never uses runtime imports between type files
- ❌ Never imports from another internal layer
- ❌ No `import type` circular dependencies

### Data Flow Examples

`stem check` data flow:

```text
cli/commands/check.ts
  -> calls core/operations/check.ts
    -> core/fs/finder.ts        finds all block and view files
    -> core/fs/reader.ts        reads source files
    -> core/parser/index.ts     parses source files into ParsedBlock[] / ParsedView[]
    -> core/graph/builder.ts    builds in-memory StemGraph
    -> core/graph/traverser.ts  computes cycles and orphaned blocks
    -> operations/schema loader loads tag schemas
    -> core/validator/rules.ts  validates graph into ValidationIssue[]
    -> returns CheckResult to cli
  -> cli formats and prints issues
  -> cli sets process.exitCode = 1 if hasErrors
```

`stem sync` data flow:

```text
cli/commands/sync.ts
  -> calls core/operations/sync.ts
    -> core/fs/finder.ts        scans all blocks and views
    -> core/cache/invalidator   determines what changed since last sync
    -> core/fs/reader.ts        reads changed files
    -> core/parser/index.ts     parses changed files
    -> core/cache/index-store   updates per-file cache entries
    -> core/graph/builder.ts    builds full in-memory graph
    -> core/cache/graph-store   writes graph snapshot to /.stem/cache/graph.json
    -> returns SyncResult to cli
  -> cli prints summary
```

### How to Add a New Feature

1. **Add types first** - define input and output types in `core/types/`.
2. **Implement in the right module** - use the single responsibility rules above.
3. **Add an operation** - if the feature coordinates multiple modules, add it in `core/operations/`.
4. **Add a CLI command** - keep it a thin wrapper that calls the operation and formats output.
5. **Write tests** - test each module independently, then integration test through the operation.
6. **Never skip layers** - a CLI command must never call a core module directly.

### Why These Rules Exist

- **Testability** - each module can be tested through simple inputs and outputs without mocking the entire system.
- **Future consumers** - the future MCP server and UI tool import `src/index.ts` only; they never need to know about CLI code or internals.
- **Replaceability** - the cache module can move from JSON files to SQLite post-MVP without changes to the parser, graph, or CLI.
- **Fewer conflicts** - contributors working on parser behavior can stay focused on parser files while contributors working on graph behavior work independently.
