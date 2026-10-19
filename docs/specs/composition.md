# Composition and publication

Status: proposed. Working agreements, not accepted or implemented behavior. Governing decision:
[ADR-0005](../decisions/0005-pure-block-model.md) (proposed). See
[architecture](../architecture.md#proposed-pure-block-design) for document ownership and D-label
navigation.

## D11. Inclusion

Block inclusions recursively expand the target subtree at the inclusion's position, preserving
authored order. Composition processes explicit authoring instructions without modifying source
Blocks or containment, preserving authored content and intentionally literal syntax according to the
representation rules. It does not automatically repair or beautify the resulting document. Markdown
is the current output format; downstream rendering determines presentation.

Composition replaces only the recognized inclusion expression with the target's recursively composed
content, preserving all surrounding text and whitespace, including newlines, regardless of line
placement; there is no automatic trimming, spacing, reindentation, or flattening.
[D26](stem-syntax.md#d26-representation-grammar)'s uniform recognition and explicit literal-escape
rules apply equally to inclusions.

Substitution does not automatically encode URLs, escape HTML or quotes, coerce content, or add
output-language validation. Authors supply content suitable for its insertion context; this does not
change [D25](#d25-export-eligibility-and-publication)'s existing error/export behavior.

The same substitution behavior applies inline and on a dedicated line; see
[inclusion syntax](stem-syntax.md#d11-inclusion-syntax) for recognition and malformed-expression
handling.

## D12. Expansion cycles

Re-entering the same Block in the same resolved project instance
([D5](project-connections.md#d5-reference-context-and-project-aliases)) on the current expansion
path through containment or inclusion is a cycle error; stop only the re-entering occurrence,
whether reached through containment or inclusion, preserving usable surrounding content with a
localized diagnostic and an incomplete result. Repeated use on separate paths is valid; reaching the
same durable Block ID in a different selected revision is not by itself a cycle.

Resolution must recognize revisits to existing instance graph nodes instead of assigning a fresh
identity on every traversal; aliases must not conceal a cycle. Instance distinctions account for
selected source state and dependency bindings, independently of optional storage or computation
sharing. A connection-graph cycle alone is not an expansion cycle unless Block expansion re-enters
an active Block instance.

## D13. Localized recovery

Throughout processing, confine recoverable errors to the smallest affected region, including regions
within Blocks. Preserve usable surrounding content and independent results, returning partial
results with localized diagnostics rather than replacing the whole Block or operation with an error.

## D14. Completeness and validity

Content completeness and validation validity are distinct: a missing inclusion target makes
composition partial and produces a validation error.

## D16. Affected results

Block-content changes refresh affected Block results and their dependent ancestor/inclusion results;
file co-location alone creates no semantic dependency. Whole-file rereading/reparsing is allowed
without treating every contained Block as semantically changed (see
[Salsa's parsing/reuse distinction](https://salsa-rs.github.io/salsa/tutorial/parser.html)).

## D17. Result dependencies and propagation

Track all inputs that affect each result, including resolution state, relevant configuration, and
supplied external source content. Stop downstream propagation when the result consumed there is
unchanged, accounting for relevant content, diagnostics, and completeness; refresh source locations
separately without persisting parse-time positions.

## D18. Disposable computation caches

Computation caches are disposable derived data: identical supplied source content and configuration
must yield identical content, diagnostics, and completeness with or without a cache. Missing,
corrupt, or incompatible caches trigger recomputation; external source content is an input whose
availability is separately required.

## D19. Current results

Current composition never silently substitutes a previous successful result or stale content for a
current error; preserve usable current content with localized diagnostics.

## D20. Evaluation inputs

Each evaluation uses the source content and configuration supplied by its adapter, unchanged during
that evaluation; changes enter subsequent evaluations. No project-wide atomic snapshot, saved
snapshot history, or new domain primitive is required. Editor adapters prevent older completed
evaluations from replacing newer results.

## D21. Regeneration

Successful regeneration uses newly supplied inputs and replaces the selected generated output, or
writes to another explicitly selected destination, subject to
[D25](#d25-export-eligibility-and-publication). Stem maintains no output history and does not
synchronize generated output back into source; adapters own writing and display.

## D24. Resource budgets

Core composition has configurable work/output budgets that account for repeated occurrences.
Exhaustion preserves available content with localized diagnostics and an incomplete result, without
itself invalidating Block definitions. Optional preview folding or additional bounded evaluation
belongs to presentation. Numeric defaults are tracked in the
[deferred design work](../../roadmap.md#pure-block-open-and-deferred-work).

## D25. Export eligibility and publication

Previews may expose partial results; normal file exports publish only complete results without
artifact-blocking errors. Definition errors in Blocks represented by an output, and resolution or
composition errors affecting that output, block normal export; unrelated project errors do not.

Prepare output in temporary storage, verify computation and writes, then safely replace the
destination atomically where supported; failure preserves any existing destination and explicitly
reports it was not updated.

This is per-file, not batch atomicity; stdout can be prepared before emission but cannot retract
bytes on downstream failure.
