# 0002. Frontmatter YAML core schema

Status: proposed

## Context

The parser must become portable for [core extraction](0001-extract-core-package.md).
Gray-matter imports Node APIs and implicitly uses older YAML semantics and engines.

## Decision

Use js-yaml 5's YAML 1.2 core schema with its built-in merge and timestamp tags.
Timestamp values remain Dates because Stem's string-field normalization rejects
or filters them; converting them to strings would change IDs, groups and references.
Enable the ready-made merge tag to preserve mapping merges; write no custom tags.
Reject other non-core YAML tags and all non-YAML engines with parser diagnostics.
Keep `---yaml` and `---yml`; normalize empty/comment-only and top-level null to `{}`.
Preserve scalar/array pass-through, delimiter behavior, body recovery and positions.

## Rejected

- Preserve gray-matter semantics with a custom schema: excessive compatibility code.
- YAML11_SCHEMA: changes booleans and collection representations beyond this step.
- Keep gray-matter in the portable parser: retains Node dependencies and engines.

## Consequences

`012` becomes 12, `0o12` becomes 10, and `1:20` remains a string.
`!!set`, `!!binary`, `!!omap` and `!!pairs` are rejected; no Buffer enters core.
JSON and JavaScript frontmatter engines are rejected; YAML merges remain supported.
js-yaml's `context.parseError` text changes; other diagnostic fields stay stable.
That detail appears in CLI JSON and MCP validation output, but not CLI text or cache.
Rename and render operations retain gray-matter on the Node side for this step.
No rules change until this proposed ADR is accepted.
