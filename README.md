# Stem

[![NPM Version](https://img.shields.io/npm/v/@stemdev/cli)](https://www.npmjs.com/package/@stemdev/cli)
[![Node version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI Status](https://github.com/stemdev-hub/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/stemdev-hub/cli/actions/workflows/ci.yml)

Stem is a Git-native, file-based documentation system for software developers. It keeps reusable knowledge in Markdown blocks and lets teams compose those blocks into multiple view files without duplicating content.

Stem is designed for teams working with AI coding agents and LLM workflows: the block store and dynamic connection graph provide structured, queryable context while keeping every source file plain Markdown in Git.

## The Problem

Software documentation gets stale, duplicated, bloated, and locked into a single perspective. Stem separates canonical content from the views people read, so one block can power onboarding, backend, frontend, architecture, and AI-agent context views.

## Prerequisites

- **Node.js**: `>=22`

## Installation

You can install Stem globally via NPM:

```sh
npm install -g @stemdev/cli
```

*For local development of the CLI itself, see [Contributing](#contributing).*

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

## Architecture

The CLI is intentionally thin. All business logic belongs in `src/core/`, and the public core API is exported from `src/index.ts` so future MCP servers, editor tools, and UI clients can import Stem without depending on CLI code.

Rendered Markdown is generated under `rendered/` by default and should not be committed unless a project intentionally publishes generated output.

## Contributing

We welcome contributions! To build the CLI locally:

```sh
pnpm install
pnpm build
pnpm link
```

Please feel free to open issues or submit pull requests on our [GitHub Repository](https://github.com/stemdev-hub/cli).

## License

[MIT](LICENSE)
