# Stem

Stem is a Git-native, file-based documentation system for software developers. It keeps reusable knowledge in Markdown blocks and lets teams compose those blocks into multiple view files without duplicating content.

Stem is designed for teams working with AI coding agents and LLM workflows: the block store and dynamic connection graph provide structured, queryable context while keeping every source file plain Markdown in Git.

## The Problem

Software documentation gets stale, duplicated, bloated, and locked into a single perspective. Stem separates canonical content from the views people read, so one block can power onboarding, backend, frontend, architecture, and AI-agent context views.

## Installation

```sh
pnpm install
pnpm build
```

After publishing, the CLI target is:

```sh
npm install -g stem-docs
stem init
```

## Basic Usage

```sh
stem init
stem create block auth-flow
stem create group by-audience/backend
stem create view auth-service --group by-audience/backend
stem add auth-flow-block to auth-service-view
stem check
stem sync
stem render view auth-service-view
stem preview view auth-service-view
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

## Commands

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
