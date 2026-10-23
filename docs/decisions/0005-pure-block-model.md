# 0005. Pure Block model and composition

Status: accepted (23 October 2026). The owner explicitly accepted this decision and the model, syntax, composition, and project-connections specifications at revision `a56203e`, alongside ADR-0007. Open mechanics and deferred implementation work remain as recorded in the roadmap; acceptance does not establish implementation or distribution. The reviewed decision body below is preserved, including its pre-acceptance wording.

## Context

Reusable content needs stable identity, explicit ownership, and predictable composition.
Files and output-language formatting cannot reliably define that ownership.

## Decision

Use ordinary, durably identified Blocks for authored content and ordered containment;
Tags classify Blocks directly. Selection and inclusion preserve source identity.
Use explicit Stem directives for inline and multiline definitions and inclusions,
with uniform recognition and explicit escaping independent of the output language.
Compose fixed supplied inputs with localized errors and complete-result publication.
File-level frontmatter is ordinary authored text, not a second source of Stem metadata.
Replace legacy APIs and behavior directly under the beta policy, updating callers and
tests and removing obsolete paths without compatibility shims or parallel legacy APIs.
Bound recursive composition with configurable work and output allowances; cycle checks
alone do not bound cycle-free repetition or the size of generated output.
Use ordinary Blocks or whole source files to assemble documents; introduce no Page type.
Named output sets map explicit source selectors to destination paths. Keep one source
directory and one parser, independent of whether content is reused or exported.
Support project-relative and native absolute output directories, including external
folders. A destination root grants access to mapped files, not ownership of its contents.
Track generated files in a destination-local manifest. Keep obsolete outputs by default;
opt-in pruning removes only recorded, unchanged files no longer targeted. During cleanup,
preserve edits and unrelated files, and require explicit cleanup of retired sets or destinations.
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
- Keeping frontmatter as a second metadata channel: creates competing authoring rules.
- Compatibility layers around the replaced model: retain obsolete paths during beta.
- Cycle detection alone as an expansion limit: finite repetition can still multiply
  output exponentially, while empty expansions consume work without emitting text.
- A Page type restricted to text and inclusions: ordinary Blocks and whole-file
  composition already provide document assembly without another authoring role/parser.
- Output profiles with inheritance or overrides: named sets group explicit mappings;
  a configuration-merging system has no demonstrated need.
- Clearing an entire output directory: outputs may share a repository root or external
  folder with authored files. Cleanup requires evidence about individual generated files.
- Keeping cleanup records only in the producer's disposable cache: destination reuse
  across checkouts or CI loses the information needed to identify obsolete outputs.

Relevant publication precedents: [Ninja's tracked obsolete-output cleanup](https://ninja-build.org/manual.html#_extra_tools),
[OpenAPI Generator's destination-local file inventory](https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator/src/main/java/org/openapitools/codegen/DefaultGenerator.java),
and [rsync's suppression of deletion on source I/O errors](https://rsync.samba.org/ftp/rsync/rsync.1.html).
These inform the choice; the composition specification owns Stem's exact protections.

## Consequences

Retire legacy Tag-schema validation during migration; defer replacement validation.
The [model specification's D23 transition contract](../specs/block-model.md#d23-schema-retirement-transition)
owns preservation of authored schema files and unsupported-setting behavior.
[Roadmap D23](../../roadmap.md#d23-schemas-structural-validation-and-templates)
owns removal tasks, sequencing, and deferred replacement features.
On acceptance, retire ADR-0002's frontmatter-parsing contract in full: its YAML schema,
engine restrictions, normalization, delimiter/body recovery, position and diagnostic
preservation obligations no longer govern the replacement source parser. This retires
Stem's interpretation of frontmatter; it does not select a new YAML policy for unrelated
formats. Replace Node-side frontmatter helpers in affected migrated operations as well.

Supersede only ADR-0004's Tag-schema decoder/export and preservation requirements;
retain its external-snapshot decoder, shape/timestamp behavior and consumer-owned
contextual handling. ADR-0001's pure-core/I/O and public-entry boundaries remain binding.
At acceptance, record these dispositions in the old ADR statuses, affected rules and
architecture applicability map; their accepted decision bodies remain historical records.
Until then, ADR-0002, ADR-0004 and existing rules remain binding in full.

Replace the legacy View file role and `viewsDir` alongside its affected callers, without
deleting authored View files or silently converting them. The
[source transition](../specs/composition.md#source-boundary-and-view-retirement) owns the
replacement configuration and preservation contract. Current user guides change only
when the replacement is implemented.

Output configuration and portable validation remain within the existing core boundary;
adapters own publication and tracking. Destination-local tracking adds operational
persistence without a new package or domain primitive. The
[publication contract](../specs/composition.md#d25-export-eligibility-and-publication)
owns manifest persistence, writer coordination, cleanup and failure behavior.

Direct replacement does not choose public API names or result shapes. Finalize the
affected replacement contracts and removals before the corresponding implementation
slice; ADR-0001's requirement for an accepted ADR covering removals/renames still applies.
[D15](../../roadmap.md#d15-dependency-review) defers dependency review;
[open work](../../roadmap.md#pure-block-open-and-deferred-work) remains unresolved.
