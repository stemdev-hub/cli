# 0001. Extract @stemdev/core

Status: accepted

## Context

Parsing, graph, validation and rendering live inside the CLI package mixed with
filesystem, network, cache and MCP code. The VS Code extension can only reuse
them by spawning the CLI, so it cannot preview unsaved edits or show diagnostics.

## Decision

Add one workspace package, `@stemdev/core`: model types, parser, graph, validator,
renderer and pure project analysis (`analyzeProject()` over supplied documents).
It has no Node built-ins, no I/O, no clock reads (time is passed in), and no
editor or CLI imports. Node project operations, filesystem, network, cache and
MCP stay in `@stemdev/cli`. The extension depends on core and supplies documents
through VS Code APIs. Core is published to npm as `@stemdev/core` and is a normal
runtime dependency of `@stemdev/cli`. The extension bundles it.

## Rejected

- Move the whole current `core/` folder: drags I/O, auth and cwd into the portable package.
- `@stemdev/cli/core` subpath: couples domain reuse to CLI/MCP installation.
- Separate parser/graph/validator/renderer packages: no independent consumer.
- `@stemdev/node` runtime package now: no second Node consumer yet.
- Ports/DI for every operation inside core: speculative.
- Keep core private and bundled into the CLI: blocks third-party and other-editor consumers.
- Do nothing: blocks direct editor reuse.

## Consequences

Package-boundary rules in docs/rules.md apply. Consumers import core only through
its public entry. The exported API is a public contract: additions are cheap,
removals and renames need an ADR. Core must be published before any CLI release
that depends on it.
