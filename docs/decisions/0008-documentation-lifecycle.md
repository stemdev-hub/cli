# 0008. Documentation lifecycle

Status: accepted (20 October 2026). Owner approved the migration plan and this decision in chat.

## Context

Stem's documentation mixes current guidance, proposed contracts, work state, and historical evidence. Blanket ADR requirements add records without consistently preserving significant rationale.

## Decision

Use repository and package guides for reader tasks, a shared current reference for supported semantics, specifications for behavioral contracts, architecture
for system explanation and navigation, and ADRs for significant choices.
Roadmap is the sole active/deferred work register; status is a compatibility pointer.
Preserve useful audit evidence separately from active work.
Require ADRs for lasting architectural choices, significant external contracts,
and reversals of accepted decisions. Ordinary documentation and specification
maintenance within accepted choices use normal owner review.
Core API removals and renames still require an ADR under ADR-0001.
Keep one canonical owner per fact; permit linked summaries and historical copies.
Preserve accepted ADR bodies, identifiers, and paths. Record full or partial supersession only through an accepted replacement, naming the affected scope.
Distinguish editable proposals, rejection, withdrawal, and accepted history.
Reviewed or referenced drafts retain a disposition; unshared scratch may be removed.
Architecture maps current applicability; roadmap records implementation and delivery.
Review at releases, or quarterly when releases pause. Beta does not erase history.
Replace the universal ADR line quota with concise-writing guidance.

## Supersession

Partially supersede ADR-0006's requirements for an ADR for every accepted-specification behavior change and every new non-ADR document. Its other provisions remain applicable.

## Consequences

After owner amendments to governance and instructions, add the shared reference,
historical records, compatibility pointers, and verification described by the approved migration.
Protected-file ownership remains unchanged. This accepts no product proposal or runtime change.

## Rejected

- A full documentation portal and separate RFC system: unjustified maintenance overhead.
- Deleting accepted decisions for tidiness: loses accessible rationale and stable links.
