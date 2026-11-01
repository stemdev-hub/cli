# Governance

Human-owned. Budget: 80 lines. Defines authority, ownership, and documentation lifecycle.

## Authority (higher wins on conflict)

axioms > governance > rules > accepted ADRs > accepted specifications > architecture

Roadmap owns work state. Usage/reference guides describe supported behavior. Proposals and historical evidence do not grant design authority. Code/tests are implementation evidence, not automatic amendments to accepted design.

## Files and who may edit

| File                                             | Canonical content                                                  | Agent may edit                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Root/nested AGENTS.md                            | entry points, read order, commands and scoped constraints          | no                                                                     |
| docs/axioms.md                                   | enduring product invariants                                        | no                                                                     |
| docs/governance.md                               | authority, ownership and lifecycle                                 | no                                                                     |
| docs/rules.md                                    | testable cross-cutting constraints                                 | only with an accepted ADR                                              |
| docs/decisions/NNNN-*.md                         | significant choices, alternatives and consequences                 | proposals yes; accepted bodies immutable, status only for supersession |
| docs/specs/*.md                                  | detailed domain, syntax and behavioral contracts                   | under the change procedure below                                       |
| docs/architecture.md                             | system explanation, code map, current applicability and navigation | reviewed factual updates; design changes follow ADR policy             |
| README.md; package READMEs                       | overview, installation and interface-specific tasks                | reviewed factual updates                                               |
| docs/reference.md                                | current shared user-facing semantics and limitations               | reviewed factual updates, scoped to verified behavior                  |
| CONTRIBUTING.md; extension CONTRIBUTING.md       | common workflow/support/release; host-specific acceptance          | reviewed factual updates                                               |
| roadmap.md                                       | sole active/deferred work register and acceptance/evidence links   | update affected work when its state changes                            |
| docs/history/*.md                                | dated, nonbinding evidence and legacy design                       | preserve observations; append dated corrections                        |
| Compatibility pointers, including docs/status.md | routes from old paths/anchors                                      | links only; no independent requirements or task state                  |
| Generated API references; package changelogs     | implementation reference; package release history                  | generator-owned; review output, never hand-edit signatures             |

## Where does a fact go?

- Enduring product identity → axiom; cross-cutting engineering constraint → rule.
- Precise agreed behavior → specification; significant choice and alternatives → ADR.
- System explanation, glossary and current-decision map → architecture.
- Supported user semantics → shared reference; interface tasks/options → package guide.
- Contribution, verification, support and release procedures → contribution guidance.
- Current/deferred work and acceptance → roadmap; dated audits and execution evidence → history.
- Exported implementation signatures → source types/TSDoc and generated declarations; release changes → package changelogs.
- Each fact has one canonical owner. Linked summaries, examples, generated views and clearly marked historical copies may repeat it without creating competing authority.

## Change procedure

- Plan first, obtain owner approval, then stay within the approved file scope. Protected files remain owner-edited unless the owner explicitly grants a scoped exception.
- Axiom: human writes a superseding ADR first, then edits. Rule changes cite an accepted ADR in the rule.
- [ADR-0008](decisions/0008-documentation-lifecycle.md) defines the documentation policy. Create ADRs for lasting architectural choices, significant external contracts, security/persistence/source-resolution boundaries, or reversal of accepted decisions.
- Ordinary documentation, editorial work, routine compatible API additions and implementation choices within accepted constraints do not themselves require ADRs. Core API removals/renames still require ADRs under ADR-0001.
- Ordinary files within the categories above may be created through normal owner review. New packages/primitives and significant architectural changes require accepted ADRs; no document count target justifies deleting useful context.
- Specifications identify status and governing ADRs. Proposed ADRs/specifications are nonbinding; explicit owner acceptance covers the actual decision and relevant specification revision.
- Accepted specifications may be maintained through owner review within accepted architectural choices. Significant architectural/external-contract changes or reversals require an accepted ADR; editorial changes preserve meaning.
- Acceptance, implementation, host acceptance and distribution are distinct. ADR status owns decision state; roadmap owns work state; reference applicability identifies observed behavior.
- Report unresolved authority conflicts and a proposed resolution; do not silently resolve them from implementation or tests.

## Decision lifecycle

- Propose with the next unused ID, context, real alternatives, consequences, affected contracts and unresolved questions. Revise or merge unaccepted drafts during review.
- Accept only with explicit owner approval; record actual acceptance evidence/date when known. Never invent dates for older records.
- Reject reviewed proposals with a reason when useful for future decisions. Withdraw abandoned/duplicate proposals explicitly.
- Reviewed/shared/referenced drafts retain their stable path and a disposition/replacement link; preserve unique rationale. Unshared, unreferenced scratch may be removed. Never reuse a shared ID.
- Accepted bodies, IDs and paths remain stable. Only an accepted replacement permits a status edit for full or partial supersession; both records name the exact replaced scope and unaffected constraints remain binding.
- Retiring an accepted constraint without a replacement behavior still requires an accepted retirement decision. Completion, age and beta status do not imply supersession.
- Archive inactive ADRs through navigation, not path changes. Do not delete accepted records for tidiness or rely only on Git for their discovery.
- Architecture links current applicability rather than copying decision bodies. Preserve meaningful historical evidence and old document anchors with concise forwarding pointers.

## Maintenance and enforcement

- Update the owning guidance/contract with behavior; update roadmap only when work state changes. Move useful completed evidence to history and prune resolved active items.
- Review applicability, unresolved proposals, rules and active work at each release, or quarterly when releases pause. Give deferred work a reconsideration trigger; age alone changes no decision state.
- Budgets: root AGENTS.md ≤100 lines; nested AGENTS.md ≤40; axioms ≤10 numbered invariants; governance ≤80; rules one testable line each; status pointer ≤60. ADRs must be concise but have no universal line quota.
- Check local links/anchors, status/supersession metadata, traceability, selected examples and generated-reference freshness. Human review checks meaning, authority and protected-file diffs.
- Keep generated outputs and fixtures distinct from guidance. Do not rewrite intentional invalid/legacy test inputs as a documentation cleanup.
- Add CODEOWNERS when a second maintainer exists. New community policies require a real reporting/support owner; roadmap records adoption triggers.
