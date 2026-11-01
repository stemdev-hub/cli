# 0010. Project identity configuration

Status: accepted (25 October 2026). The owner approved the identity lifecycle and four-file documentation checkpoint in chat, with the subsequent refinement removing configuration `version`. Implementation and verification are tracked in the [roadmap](../../roadmap.md#pure-block-migration).

## Context

ADR-0007 establishes durable project identity, but current CLI/editor readers return successful
default configurations when the file is missing. The public `getDefaultPortableConfig()` and
`getDefaultStemConfig()` constructors produce complete configurations without identity, and
initialization with force overwrites configuration from defaults. These contracts cannot establish
or preserve durable identity. ADR-0001 requires explicit decision coverage for core API removals.

The optional configuration `version` defaults to `"1"` and rejects other values; it selects no
alternate interpretation. The beta policy supports direct replacement, and shape validation already
rejects unsupported configuration. Package versions and other persisted-format versions have
separate responsibilities.

## Decision

Require a durable `projectId` in versioned project configuration. Explicit creation generates it
in the Node adapter; portable core validates supplied identity. Reads fail for missing or invalid
configuration without inventing, replacing or persisting identity. Repeated initialization and
force preserve existing valid identity; invalid existing configuration requires an explicit author
correction. The [identity specification](../specs/project-connections.md#project-identity-configuration)
owns UUIDv4 spelling, validation, initialization, errors and deliberate-copy behavior.

Remove core's `getDefaultPortableConfig()` and CLI's `getDefaultStemConfig()` exports directly,
without compatibility aliases. Callers supply identity to existing normalization/resolution APIs.
Require `projectId` in the complete configuration types; preserve partial raw inputs for validation.
Retain only actual setting defaults in `STEM_CONFIG_DEFAULTS`.

Remove project configuration `version`, its default and `CONFIG_UNSUPPORTED_VERSION`. Reject a
remaining key using ordinary unknown-field validation, with no retired-field lookup or migration
diagnostic. Do not change package release versions or independently specified persisted formats.

## Rejected

- Generate identity while reading, or use a dummy/path-derived default: loses explicit identity ownership.
- Preserve identity-free constructors or introduce compatibility overloads: allows apparently complete configurations without required identity.
- Add another constructor requiring identity: duplicates the existing validated normalization path without a demonstrated caller need.
- Let force reset identity or repair invalid configuration: silently changes project meaning and discards authored settings.
- Retain or increment configuration `version`: adds a format discriminator without another supported interpretation in this replacement.
- Add an identity-reset command now: explicit configuration editing already expresses the required intent.

## Consequences

This covers the public configuration changes under ADR-0001/0008 and refines ADR-0007 without
superseding its connection semantics. No accepted ADR body, protected file, package boundary or
domain primitive changes. Existing configurations must explicitly contain valid identity and omit
unsupported fields; there is no compatibility fallback or automatic conversion.

Update CLI/editor readers, initialization, public callers, fixtures and current guidance together
in the bounded [implementation checkpoint](../../roadmap.md#durable-project-identity-checkpoint).
Pure parsing remains independent. Connection checks, Git transport/storage, output publication and
cleanup follow separately. Acceptance here establishes neither runtime implementation, host
acceptance nor distribution.
