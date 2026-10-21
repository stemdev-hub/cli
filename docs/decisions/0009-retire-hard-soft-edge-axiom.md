# 0009. Retire the hard/soft-edge axiom

Status: accepted (20 October 2026). Owner adopted the retirement wording and approved recording this decision in chat.

## Context

The former axiom 7 at `64ad029a57a977be9dbfc46f73e86d4a3254fb2b` required hard and soft edges to be distinct types. Inclusion and dependency behavior need clear descriptions, but a graph-edge classification need not be an enduring product invariant.

Its deletion was already present as an unaccepted working-tree change. This decision records approval on the date above; it does not backdate acceptance or imply that the earlier edit followed the approval sequence.

## Decision

Retire the former axiom “Hard edges (transclusion) and soft edges (dependency) are distinct types.” Inclusion and dependency behavior belong in their applicable behavioral documentation; the axioms do not prescribe their graph representation. This decision changes no implemented behavior and does not accept deferred dependency-review work or the Pure Block proposals.

## Rejected

- Retain edge taxonomy as a product axiom: constrains graph representation without defining Block/Tag identity or the behavior readers need.

## Consequences

Only the former hard/soft-edge axiom is retired. The current [axioms](../axioms.md) already reflect the approved deletion and renumbering; no further edit is needed. Other axioms and accepted ADRs remain applicable.

The [current reference](../reference.md#references-and-selection) describes inclusion, while [frontmatter](../reference.md#files-and-frontmatter) describes existing dependency metadata. [Dependency review](../../roadmap.md#d15-dependency-review) remains deferred. Any future behavior or API change follows the normal decision and implementation process.
