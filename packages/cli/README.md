# @stemdev/cli

[![NPM Version](https://img.shields.io/npm/v/@stemdev/cli)](https://www.npmjs.com/package/@stemdev/cli)
[![Node version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The official command-line interface for **Stem**, a Git-native, file-based documentation system for software developers. Includes Node.js project operations and a stdio MCP context server. The portable domain API lives in [@stemdev/core](https://github.com/stemdev-hub/cli/tree/main/packages/core).

## Prerequisites

- **Node.js**: `>=22`

## Installation

Install the Stem CLI globally via NPM:

```sh
npm install -g @stemdev/cli
```

## Getting Started

Stem breaks down documentation into reusable **Blocks** and composed **Views**.

### 1. Initialize a Project

Run this in the root of your repository to scaffold the `.stem/` directory:

```sh
stem init
```

### 2. Write Reusable Blocks

Blocks are single-source-of-truth markdown files that contain frontmatter metadata.

```sh
stem create block auth-flow
```

This creates `blocks/auth-flow-block.md` with ID `auth-flow-block`. Replace its body and tags with your content, for example:

```markdown
---
id: auth-flow-block
tags: [backend, security]
---

# Authentication Flow

We use JWT tokens for authentication. The token expires every 15 minutes and is refreshed automatically via the `/refresh` endpoint.
```

### 3. Compose Views

Views are constructed by referencing your blocks. Create a view and inject your block into it:

```sh
stem create group by-audience/backend
stem create view auth-service --group by-audience/backend
stem add auth-flow-block to auth-service-view
```

The view command creates `views/by-audience/backend/auth-service-view.md` with ID `auth-service-view`. Use the generated IDs when adding references or rendering.

### 4. Render & Preview

Validate your references and render the final composed Markdown files:

```sh
stem check
stem sync
stem render view auth-service-view
```

To quickly view the result in your terminal without writing files to disk:

```sh
stem preview view auth-service-view
```

_(Note: For the best experience, use the [Stem VS Code Extension](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem) for live previews!)_

For block/view frontmatter, section/tag selection, parameters and known rendering limits, see the [current reference](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md). The accepted Pure Block notation is not yet implemented by this quickstart.

## Configuration

Stem discovers projects through a `.stem/` directory and requires valid `.stem/config.json` settings.
Run `stem init` to establish a new project's durable `projectId`. The example below shows its shape;
keep your generated ID rather than copying the example identity into another project.

```json
{
  "projectId": "0f671f2d-657d-4f3c-9a7d-d22f769c083a",
  "blocksDir": "blocks",
  "viewsDir": "views",
  "cacheDir": ".stem/cache"
}
```

All directory fields are project-relative and optional. Paths are normalized to POSIX `/` separators so cache keys stay stable across operating systems.

Commit `.stem/config.json` with your project. Moves, renames and additional checkouts preserve its
identity. Missing configuration or a missing/invalid ID is an error; reading, checking and preview
never create or repair it. Configuration has no `version` field; package and cache/snapshot versions
are separate. See the [identity contract](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md#project-identity).

Repeated `stem init` reports a conflict. `stem init --force` preserves valid configuration bytes
and identity while completing missing scaffold directories and ignore entries using configured
paths. Both modes reject invalid existing configuration before writes. If a later scaffold step
fails after configuration was created, the established ID remains; retry with force after correcting
the failure. Force never overwrites another initializer's configuration.

For an intentionally independent project copy, generate a fresh ID, for example with
`node -p "require('node:crypto').randomUUID()"`, and explicitly replace only `projectId` in its
configuration. This does not rewrite Block IDs or transfer existing output ownership. Restore lost
configuration from version control when you intend to retain the original identity.

Unknown configuration keys and typos are errors, including inside namespace entries. See the
[supported configuration fields](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md#configuration-validation).
Tag-schema validation has been removed; existing schema files are preserved and no longer loaded as schemas.

`cacheDir` controls the internal `index.json` and `graph.json` files; its default is `.stem/cache`. Namespace snapshots use the fixed locations documented in the [shared reference](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md#namespace-snapshots); changing `cacheDir` does not relocate them.

## Commands Reference

| Command                                                        | Purpose                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `stem init [--force]`                                          | Establish project identity; force completes scaffolding while preserving valid configuration |
| `stem create block <name> [--tag <tag>]`                       | Create a Markdown block, optionally scaffolded with a tag                                 |
| `stem create view <name> [--group <path>]`                     | Create a view file, optionally inside a view group                                        |
| `stem create group <path>`                                     | Create a view group directory                                                             |
| `stem add <block-id> to <view-id> [--section <s>] [--tag <t>]` | Append a block reference to a view                                                        |
| `stem delete block <id> [--force]`                             | Delete a block after reference checks                                                     |
| `stem delete view <id>`                                        | Delete a view                                                                             |
| `stem rename <old-id> <new-id>`                                | Rename a block ID and update references                                                   |
| `stem render view <view-id> [--out <dir>] [--stdout]`          | Render one view to Markdown                                                               |
| `stem render all [--out <dir>]`                                | Render all views to Markdown                                                              |
| `stem preview view <view-id>`                                  | Print a rendered view to the terminal without writing files                               |
| `stem list blocks [--tag <tag>] [--json]`                      | List blocks and usage metadata                                                            |
| `stem list views [--block <block-id>] [--json]`                | List views and referenced blocks                                                          |
| `stem check [--json] [--strict-external] [--use-remote]`       | Validate without writing files                                                            |
| `stem sync`                                                    | Rebuild `index.json` and `graph.json` in the configured `cacheDir`                        |
| `stem publish-graph`                                           | Upload a structural snapshot using the configured namespace and publish target            |
| `stem fetch-namespaces`                                        | Fetch configured snapshots; an available local snapshot can take precedence               |
| `stem mcp`                                                     | Start the stdio MCP context server in the current Stem project                            |
| `stem mcp setup [-y, --yes]`                                   | Configure supported AI assistants; interactive scope selection or noninteractive defaults |

Run `stem --help` or `stem <command> --help` for supported options. Namespace commands require the corresponding project configuration; they do not create a hosted service. `--json` is available on `check` and `list`.

## Namespace snapshots and publishing

The optional configuration fields supplement the defaults above:

| Field        | Meaning                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `namespace`  | Published snapshot namespace, separate from `projectId`; kebab-case, excluding the reserved `stem-` prefix |
| `publishUrl` | An HTTP endpoint that accepts an authenticated PUT of the structural graph           |
| `namespaces` | Map of namespace names to `graphUrl`, `localPath`, or both                           |

Directory fields are project-relative and cannot contain `..`. Namespace `localPath` is also relative, but may point to a sibling project using `..`. The file must be JSON.

For a consumer of a remote structural snapshot, merge this entry into `.stem/config.json`, replacing the example URL with your own endpoint:

```json
{
  "namespaces": {
    "team": { "graphUrl": "https://example.com/team/stem-graph.json" }
  }
}
```

Run `stem fetch-namespaces`, inspect reported warnings/skips, then `stem check`. Use `stem check --strict-external` to promote external warnings, or `stem check --use-remote` to bypass local namespace paths while checking. The fetch command itself has no `--use-remote` flag.

A `localPath` entry expects that project's external snapshot at `.stem/cache/stem-graph.json`. Current sync creates a different internal graph, and publishing does not save the external snapshot locally. Do not treat a sibling source checkout alone as a complete local-snapshot setup. See [snapshot limitations](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md#namespace-snapshots).

To publish a snapshot, configure your own `namespace` and `publishUrl`, supply authentication, and explicitly run `stem publish-graph`. It uploads structural metadata, not document prose. GitHub Actions OIDC is attempted when its request environment is present; otherwise `STEM_PUBLISH_KEY` supplies the bearer token. Your endpoint must accept that token and PUT format; Stem does not provision hosting or native S3/GCS integration. Keep credentials out of committed configuration.

## MCP server

Run `stem mcp` with the client's working directory set to the Stem project. Configure the client to launch that command over stdio; this is not an HTTP server.

`stem mcp setup` offers Antigravity and Claude setup. It can write configuration or invoke the installed Claude CLI; review its prompts and scope choices. `--yes` skips prompts and may configure detected Claude Desktop globally. VS Code/Cursor setup is provided by the extension command linked below.

| Capability        | Name                 | Result                                                    |
| ----------------- | -------------------- | --------------------------------------------------------- |
| Tool              | `list_blocks`        | Block metadata, optionally filtered by `tag`              |
| Tool              | `list_views`         | View metadata, optionally filtered by `blockId`           |
| Tool              | `check_references`   | Validation issues, including broken references and cycles |
| Resource template | `stem://blocks/{id}` | Raw block Markdown                                        |
| Resource template | `stem://views/{id}`  | Composed view Markdown                                    |

The tools expose structured results and text fallbacks. These capabilities read project context; they do not expose authoring commands as MCP tools. See the [extension's MCP setup guide](https://github.com/stemdev-hub/cli/blob/main/packages/vscode-stem/README.md#ai-context-server-mcp) for VS Code and Cursor configuration.

## Programmatic API

The package provides ESM project operations and their Node.js adapter types through `@stemdev/cli`:

```typescript
import { checkProject } from '@stemdev/cli';

const result = await checkProject({ startDir: process.cwd() });
if (!result.success) throw new Error(result.error.message);
console.log(result.data.validation);
```

Import portable parsing, graph, rendering, and domain/configuration types from `@stemdev/core`. The former CLI domain/configuration type exports are not compatibility re-exports. Use the public package entries; do not import internal source paths.

## Contributing

See the [repository contribution guide](https://github.com/stemdev-hub/cli/blob/main/CONTRIBUTING.md) for workspace setup, validation, and release procedures.

## License

[MIT](https://github.com/stemdev-hub/cli/blob/main/LICENSE)
