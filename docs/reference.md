# Current Stem reference

This describes the implemented Markdown format in the checkout based on `64ad029a57a977be9dbfc46f73e86d4a3254fb2b` (20 October 2026): core 0.1.0, CLI 0.3.1, extension 0.4.1. These are source package versions, not verification of registry or Marketplace delivery. Keep this applicability statement with behavior changes.

The [Pure Block specifications](architecture.md#proposed-pure-block-design) remain proposed. Their `@stem:block(...)` / `@stem:include(...)` notation is not the format described here. Accepted design and implementation can differ; [roadmap](../roadmap.md#current-behavior-and-policy) records unresolved choices.

Use the [CLI guide](../packages/cli/README.md) for installation, configuration and commands, the [editor guide](../packages/vscode-stem/README.md) for preview/MCP setup, and the [core guide](../packages/core/README.md) for integration.

## Files and frontmatter

A current block file is Markdown with YAML frontmatter containing a nonempty string `id`. A view has its own string `id` and a Markdown body containing references and local prose. Files are discovered under the configured block/view directories; a section in this legacy representation is not another domain primitive.

| Field        | Used by          | Current interpretation                                                                                                   |
| ------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`         | Blocks and views | Required nonempty string; surrounding whitespace is trimmed. Keep project IDs unique.                                    |
| `tags`       | Blocks           | Array of string classification labels; non-string entries are filtered out. This is separate from tagged body fragments. |
| `depends-on` | Blocks           | Array of string references such as `other-block#details.note`; records dependencies rather than inserting prose.         |
| `group`      | Views            | Optional nonempty string, trimmed; CLI grouping also organizes files.                                                    |

Frontmatter uses YAML 1.2 core semantics with merge and timestamp tags. Timestamp values do not become string IDs. Empty/comment-only/null YAML becomes an empty object; missing IDs and malformed YAML produce diagnostics. `---yaml` and `---yml` are recognized; other frontmatter engines are rejected by the portable parser.

[ADR-0002](decisions/0002-frontmatter-yaml-core-schema.md) governs this portable frontmatter policy. Node-side rename/render helpers still use gray-matter; acceptance does not establish identical parsing in every operation.

## Body markers and classification

The current notation uses `@stem[...]` macros. Markdown code blocks, inline code and raw HTML nodes are outside the plugin's ordinary text traversal; this differs from the proposed uniform-recognition syntax. Keep active markers in ordinary Markdown text.

| Notation                              | Purpose                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@stem[section:details]`              | Opens a named section.                                                                                        |
| `@stem[tag:note]`                     | Opens a tagged content fragment in the current section, or a standalone fragment.                             |
| `@stem[tag:note section=details]`     | Binds a fragment to the named section, even when authored elsewhere in the file.                              |
| `@stem[end]`                          | Closes the current tag first; otherwise closes the current section.                                           |
| `@stem[dep:other-block#details.note]` | Records a local dependency; it does not insert content and does not support external namespaces or arguments. |

Use simple identifiers such as `auth-flow`, `details` and `note` in macros. Close fragments and sections explicitly. This format does not implement the proposed nested Block ownership model. Frontmatter classification labels, body fragment tags, and section tag collections are different legacy uses of the word “tag.”

For example, a block can contain two fragments with the same tag:

```markdown stem-check=tags-block
---
id: source
tags: [guide]
---

Other prose.
@stem[section:details]
@stem[tag:note]
First.
@stem[end]
@stem[tag:note]
Second.
@stem[end]
@stem[end]
```

## References and selection

| Reference                                      | Current behavior                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@stem[block:source]`                          | Selects the block body.                                                                                          |
| `@stem[block:source section=details]`          | Selects section content.                                                                                         |
| `@stem[block:source section=details tag=note]` | Selects matching fragments in that section, in source order.                                                     |
| `@stem[block:source tag=note]`                 | **Known limitation:** without a section, current rendering selects the whole block body, not only matching tags. |
| `@stem[block:team:source]`                     | Carries an external namespace for validation; a metadata snapshot does not supply prose for rendering.           |

Duplicate matching fragments are joined with a newline by the legacy renderer. Duplicate-tag validation can still warn; the historical claim that the renderer returns an unjoined array is incorrect.

This view selects the two fragments above:

```markdown stem-check=tags-view
---
id: fragment-view
---

@stem[block:source section=details tag=note]
```

Expected Markdown (with a final newline):

```text stem-check=tags-output
First.
Second.
```

Legacy replacement strips recognized standalone control-marker lines and trims the selected content. It is not the proposed exact-whitespace composition contract. When called without project validation, core's legacy `renderViewMarkdown` path can leave a missing target as literal reference text and report success; core callers must [validate explicitly](#validation-and-diagnostics). CLI rendering, terminal preview, and editor preview validate first and reject missing local block references.

## Parameters and placement

Parameterized references already exist in the current implementation. Use comma-separated named string arguments, for example `@stem[block:database, db_name="PostgreSQL"]`. A selected fragment can contain `{{db_name}}`; substitution is single-pass. Missing variables and invalid arguments produce diagnostics. Quoted values are not output-language escaping.

```markdown stem-check=parameters-block
---
id: database
---

Database: {{db_name}}
```

```markdown stem-check=parameters-view
---
id: database-view
---

@stem[block:database, db_name="PostgreSQL"]
```

Expected Markdown:

```text stem-check=parameters-output
Database: PostgreSQL
```

The extended/parameterized path uses Markdown AST composition: a reference must occupy its own paragraph in a supported flow container (including blockquotes and list items). Inline placement is rejected. It can normalize Markdown formatting and does not preserve a final newline in this example. When a view uses an extended reference, that composition path processes the view's references together. Do not assume the legacy replacement path has identical placement or formatting behavior.

## Validation and diagnostics

Run `stem check` before relying on rendered results. It reads project documents and reports parser/frontmatter issues, duplicate/missing targets, section/tag references, dependency/cycle issues, schema failures and external-snapshot issues. `--json` preserves structured issue information; `--strict-external` promotes external warnings to errors; `--use-remote` bypasses local namespace paths during checking.

Core callers use `analyzeProject(snapshot, { nowMs })` for full supplied-project validation. Calling the renderer or building a graph alone does not replace that validation. Public issue types and result shapes are generated from [core exports](../packages/core/src/index.ts) and [CLI declarations](../packages/cli/docs/stem-api.d.ts).

Current transclusion depth/cycle policy and external graph identity have unresolved design questions. No proposed recursive-composition, complete-result publication, or connection-lifecycle guarantee is implied here.

## Current Tag schemas

Tag schemas still exist under [ADR-0004](decisions/0004-core-schema-and-snapshot-decoders.md). The default schema directory is `blocks/schemas`. Schema YAML has a string `name` and an array of required strings; `description` is optional:

```yaml stem-check=schema
name: note
required:
  - Context
  - Decision
```

Validation finds tagged body fragments with that name and checks whether each required string occurs in the fragment's content. It is a substring-presence check, not a general Markdown structure validator, and frontmatter labels alone do not supply tagged content. Missing required text produces `SCHEMA_VIOLATION`.

The Pure Block proposal would retire this feature, but has not been accepted. Its [D23 transition contract](specs/block-model.md#d23-schema-retirement-transition) is a proposal, not a current removal instruction.

## Namespace snapshots

Current cross-project support exchanges structural metadata. The published graph contains namespace/version/timestamps, block IDs, classification labels, section/tag names and recent rename entries; it does **not** contain block prose or source paths.

`contentSha` hashes the sorted block and rename metadata, not the complete local graph or Markdown content. The internal cache `graph.json`, external `stem-graph.json`, and fetched namespace envelope are different representations.

A configured `localPath` expects an external snapshot at `<localPath>/.stem/cache/stem-graph.json`. `stem sync` produces the internal graph instead, and `stem publish-graph` uploads the external graph without saving that local file. Thus a local-only connection currently lacks a built-in external-snapshot producer. Do not rename `graph.json` to work around this mismatch.

Remote downloads are cached as `{ fetchedAt, graph }` under `.stem/cache/namespaces/<namespace>.json`; fetching can skip a remote URL when an available local snapshot takes precedence. The current envelope decoder requires a string `fetchedAt`, not a validated date. These paths/policies are not the proposed independent Git connection system.

External snapshots support reference checking, not reliable external transclusion. Current rendering resolves supplied blocks by local ID without namespace-aware source resolution; a same-ID local block can be selected for a namespaced reference. Without supplied prose, a legacy external reference may remain unexpanded. Treat this as a known limitation, not a supported remote composition workflow.

See the [CLI namespace procedure](../packages/cli/README.md#namespace-snapshots-and-publishing) and [remaining work](../roadmap.md#remaining-namespace-issues). The [legacy PRD](history/legacy-cli-prd.md) is historical evidence, not a competing current reference.
