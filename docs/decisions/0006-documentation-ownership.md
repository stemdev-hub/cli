# 0006. Documentation ownership

Status: accepted (19 October 2026); the requirements for an ADR for every accepted-specification behavior change and every new non-ADR document are superseded by [ADR-0008](0008-documentation-lifecycle.md) (20 October 2026). Other provisions remain applicable. Original acceptance included an owner-authorized one-time governance-editing exception.

## Context

ADR-0005 mixes decisions, behavioral contracts, and migration work.
Splitting every specification topic into an ADR adds unnecessary process.
Governance lacks specification ownership and a clear path for drafting ADRs.

## Decision

Keep significant choices and their alternatives in short ADRs; put detailed
domain, syntax, and behavioral contracts in specifications under `docs/specs/`.
Accepted specifications rank below accepted ADRs and above architecture.
Rules retain cross-cutting engineering constraints; existing rules stay binding.
Specifications identify their status and governing ADRs; drafts are nonbinding.
Owner acceptance of product ADRs and their specifications is separate from this ADR.
Behavior changes to accepted specifications require an accepted ADR; editorial
clarifications may not change their meaning. Implementation docs remain generated.
Allow proposed ADRs to be drafted for review; other new docs need an accepted ADR.
Retain accepted ADR bodies; status-only supersession identifies the replaced scope.
Do not use an ambiguous stale status or renumber historical records.

## Rejected

- One large ADR: mixes rationale, contracts, and changing work plans.
- An ADR per specification topic: duplicates contracts without independent decisions.
- Deleting accepted beta records: loses rationale still relevant to current boundaries.

## Consequences

After owner-applied [governance](../governance.md) and root instruction amendments,
authorize four proposed specs: `block-model.md`, `stem-syntax.md`, `composition.md`,
and `project-connections.md`; existing architecture provides their navigation.
Condense ADR-0005 and draft ADR-0007 for independent project connections.
Roadmap owns migration and deferred work; status links to it. Update existing
README/CONTRIBUTING navigation and template status guidance; add no separate index.
Preserve D-label traceability and all working agreements during extraction.
This accepts no product behavior, changes no runtime API, and supersedes no older ADR.
