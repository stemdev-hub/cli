# 0005. Pure Block model and composition

Status: proposed. Product acceptance and implementation remain deferred.

## Context

Reusable content needs stable identity, explicit ownership, and predictable composition.
Files and output-language formatting cannot reliably define that ownership.

## Decision

Use ordinary, durably identified Blocks for authored content and ordered containment;
Tags classify Blocks directly. Selection and inclusion preserve source identity.
Use explicit Stem directives for inline and multiline definitions and inclusions,
with uniform recognition and explicit escaping independent of the output language.
Compose fixed supplied inputs with localized errors and complete-result publication.
Contracts live in the proposed [model](../specs/block-model.md),
[syntax](../specs/stem-syntax.md), and [composition](../specs/composition.md) specs.
Independent project connections are a separate decision in [ADR-0007](0007-independent-project-connections.md).

## Rejected

- Implicit grouping by files or formatting: ownership must be explicit.
- Automatic composition of Tag matches: classification supplies no assembly order.
- Dedicated-line-only syntax: reusable fragments must also work in headings and sentences.
- Markdown/HTML-context protections: prevent reuse inside code and other authored content.
- Adapting legacy Tag schemas now: their required-text checks assume Tag-owned content;
  the classification model supplies no equivalent, so adaptation requires a redesign.

## Consequences

Retire legacy Tag-schema validation during migration; defer replacement validation.
[D23 migration work](../../roadmap.md#d23-schemas-structural-validation-and-templates)
owns removal tasks, preservation of authored files, and unsupported-setting handling.
On acceptance, supersede only ADR-0004's Tag-schema decoder/export and preservation
requirements; retain its external-snapshot requirements and pure-core/I/O boundaries.
Until then, ADR-0004 and existing rules remain binding.
[D15](../../roadmap.md#d15-dependency-review) defers dependency review;
[open work](../../roadmap.md#pure-block-open-and-deferred-work) remains unresolved.
