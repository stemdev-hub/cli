# Governance

Human-owned. Budget: 80 lines. Defines how context itself is managed. Read only when changing docs.

## Authority (higher wins on conflict)

axioms > governance > rules > accepted ADRs > architecture > status

## Files and who may edit

| File                          | Holds                                | Agent may edit                                  |
| ----------------------------- | ------------------------------------ | ----------------------------------------------- |
| AGENTS.md                     | entry point, commands, pointers      | no                                              |
| nested AGENTS.md (packages/*) | per-package commands and constraints | no                                              |
| docs/axioms.md                | invariants, ≤10 lines                | no                                              |
| docs/governance.md            | this file                            | no                                              |
| docs/rules.md                 | one testable line per rule           | only with an accepted ADR                       |
| docs/decisions/NNNN-*.md      | decision, why, rejected alternatives | new files yes; accepted ones: status field only |
| docs/architecture.md          | the model and its reasoning          | yes, when an ADR changes it                     |
| docs/status.md                | open bugs, next steps                | yes, freely                                     |

## Where does a fact go?

- Never changes, defines what Stem _is_ → axiom
- Checkable "must/never" about the spec or code → rule
- A choice with alternatives rejected → ADR
- Explains how the pieces fit → architecture
- Volatile (bug, todo, open question) → status
- Describes implementation → neither; TSDoc/types are the source

## Change procedure

- Axiom: human writes superseding ADR first, then edits.
- Rule: needs an ADR reference (`ADR-NNNN`) in the line.
- ADR: new file. Accepted ADRs are never rewritten; supersede with a new one and set old status to `superseded by NNNN`.
- Agent finds a gap or conflict: reports it with a proposed one-line change. Does not apply it.

## Anti-bloat

- One fact, one file. Everything else links.
- Budgets: root AGENTS.md ≤100 lines, each nested AGENTS.md ≤40, axioms ≤10, governance ≤80, rules one line each, ADR ≤40 lines, status ≤60.
- No new doc files or directories without an ADR.
- Delete resolved status items. Git keeps history.
- Prune pass: review rules/ADRs for staleness each release.

## Enforcement

Human review of diffs protects human-owned files (check `git diff` on them before every commit). CI checks line budgets. Prose here is not enforcement. Add CODEOWNERS when a second maintainer exists.
