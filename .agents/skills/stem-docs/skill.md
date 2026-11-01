---
name: stem-docs
description: Maintain and audit Stem documentation, including documentation affected by code changes. Use for guides, specifications, ADRs, work tracking, governance, and agent instructions.
---

Read [governance](../../../docs/governance.md) for authority, canonical ownership,
document lifecycle and budgets. Follow its [change procedure](../../../docs/governance.md#change-procedure),
including protected-file approval requirements. Keep those policies there; do not copy them into this skill.

Use the [contribution workflow](../../../CONTRIBUTING.md#contribution-workflow)
and its [documentation consistency review](../../../CONTRIBUTING.md#documentation-consistency-review).

- Before drafting, locate the canonical owner for each affected fact. Use the
  [architecture map](../../../docs/architecture.md#current-decision-applicability)
  to select relevant ADRs/specifications rather than reading the full decision log for every task.
- Use `rg` to find changed terms, commands, settings, statuses and incoming links
  across repository-owned material, including hidden local skills and agent instructions.
  Follow affected summaries and examples beyond the edited file. Keep dependency/build output
  out of the guidance inventory and identify historical records and fixtures separately.
  Search according to the requested scope: a bounded edit does not require a repository-wide audit.
- Check claims against the relevant evidence: accepted decisions/contracts for design,
  source and tests for implementation, and artifact/host/distribution results for delivery.
  Surface discrepancies with file/line evidence; do not infer acceptance or release from implementation.
- Run the applicable [verification profile](../../../CONTRIBUTING.md#verification).
  Use the shared consistency review to assess meaning and ownership beyond automated checks.
  Report inspected coverage, exclusions and unresolved findings as required by that review.

Read-only impact searches may discover fixes outside the approved edit scope.
Report those findings and follow the contribution workflow before expanding the change.
