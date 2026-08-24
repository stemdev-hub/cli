# @stemdev/cli

[![NPM Version](https://img.shields.io/npm/v/@stemdev/cli)](https://www.npmjs.com/package/@stemdev/cli)
[![Node version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The official command-line interface and core API for **Stem**—a Git-native, file-based documentation system for software developers.

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

**What does a block look like?**

```markdown
---
id: auth-flow
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
stem add auth-flow to auth-service
```

### 4. Render & Preview

Validate your references and render the final composed Markdown files:

```sh
stem check
stem sync
stem render view auth-service
```

To quickly view the result in your terminal without writing files to disk:

```sh
stem preview view auth-service
```

_(Note: For the best experience, use the [Stem VS Code Extension](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem) for live previews!)_

## Configuration

Stem projects are rooted by a `.stem/` directory. Project settings live in `.stem/config.json`; if that file is missing, Stem uses defaults.

```json
{
  "version": "1",
  "blocksDir": "blocks",
  "viewsDir": "views",
  "schemasDir": "blocks/schemas",
  "cacheDir": ".stem/cache"
}
```

All directory fields are project-relative and optional. Paths are normalized to POSIX `/` separators so cache keys stay stable across operating systems.

## Commands Reference

| Command                                                        | Purpose                                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `stem init [--force]`                                          | Create the project scaffold, built-in schemas, and `.stem/cache/` gitignore entry |
| `stem create block <name> [--tag <tag>]`                       | Create a Markdown block, optionally scaffolded with a tag                         |
| `stem create view <name> [--group <path>]`                     | Create a view file, optionally inside a view group                                |
| `stem create group <path>`                                     | Create a view group directory                                                     |
| `stem add <block-id> to <view-id> [--section <s>] [--tag <t>]` | Append a block reference to a view                                                |
| `stem delete block <id> [--force]`                             | Delete a block after reference checks                                             |
| `stem delete view <id>`                                        | Delete a view                                                                     |
| `stem rename <old-id> <new-id>`                                | Rename a block ID and update references                                           |
| `stem render view <view-id> [--out <dir>] [--stdout]`          | Render one view to Markdown                                                       |
| `stem render all [--out <dir>]`                                | Render all views to Markdown                                                      |
| `stem preview view <view-id>`                                  | Print a rendered view to the terminal without writing files                       |
| `stem list blocks [--tag <tag>] [--json]`                      | List blocks and usage metadata                                                    |
| `stem list views [--block <block-id>] [--json]`                | List views and referenced blocks                                                  |
| `stem check [--json]`                                          | Validate without writing files                                                    |
| `stem sync`                                                    | Rebuild `.stem/cache/index.json` and `.stem/cache/graph.json`                     |

## License

[MIT](LICENSE)
