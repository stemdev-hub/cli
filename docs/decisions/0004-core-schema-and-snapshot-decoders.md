# 0004. Core schema and snapshot decoders

Status: accepted; partially superseded by [ADR-0005](0005-pure-block-model.md) for Tag-schema decoder/export and preservation requirements (23 October 2026), and for preservation of the legacy external-snapshot shape (owner-directed ADR-0005 amendment, 26 October 2026). Pure external-snapshot decoder APIs, shared validation of the replacement shape, cached envelopes, permissive timestamp strings and consumer-owned contextual handling remain binding. The decision body below is preserved; roadmap owns implementation state.

## Context

The extension is a second consumer of schema and cached-snapshot decoding.
These checks currently live inside CLI loaders; duplicating them risks drift.
This prerequisite supports [core extraction](0001-extract-core-package.md).

## Decision

Core exports pure `decodeTagSchemaYaml(content)` and
`decodeExternalSnapshotEnvelope(value)` through its public entry.
`TagSchemaDecodeResult` distinguishes YAML failures (with their original cause)
from shape failures; successful schemas own a copied required array.
Envelope decoding reuses `isExternalStemGraphShape`, requires string `fetchedAt`,
and returns a cached `ExternalSnapshotState` or `undefined`.
Preserve existing CLI decoding semantics, including permissive timestamp strings.
Consumers retain JSON parsing, I/O, paths, fallback order, local timestamps,
warnings, and contextual error messages. Decoders take no paths or clock inputs.

## Rejected

- Extension-local decoders: duplicate checks would drift from CLI behavior.
- Shared loader with ports: deferred pending the namespace/snapshot ADR.

## Consequences

CLI loaders use core's decoders as the single source for these shape checks.
Schema YAML uses the existing loader policy; frontmatter policy is unchanged.
No shared namespace loader or external artifact format is introduced.
The public API additions are covered by portable execution and parity tests.
A proposed decoding-boundary rule is reported for human review; rules stay unchanged.
