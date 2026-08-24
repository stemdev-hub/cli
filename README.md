# Stem

[![CI Status](https://github.com/stemdev-hub/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/stemdev-hub/cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Stem is a Git-native, file-based documentation system for software developers. It keeps reusable knowledge in Markdown blocks and lets teams compose those blocks into multiple view files without duplicating content.

Stem is designed for teams working with AI coding agents and LLM workflows: the block store and dynamic connection graph provide structured, queryable context while keeping every source file plain Markdown in Git.

## The Problem

Software documentation gets stale, duplicated, bloated, and locked into a single perspective. Stem separates canonical content from the views people read, so one block can power onboarding, backend, frontend, architecture, and AI-agent context views.

## Ecosystem

Stem is composed of two main packages:

1. **[`@stemdev/cli`](./packages/cli/README.md)**: The core command-line interface for creating, managing, and rendering Stem projects.
2. **[`vscode-stem`](./packages/vscode-stem/README.md)**: The official VS Code extension providing live, side-by-side previews of your composed Markdown views.

_(We recommend installing both! See their respective READMEs for installation and usage instructions.)_

## Architecture

The CLI is intentionally thin. All business logic belongs in `src/core/`, and the public core API is exported from `src/index.ts` so future MCP servers, editor tools, and UI clients can import Stem without depending on CLI code.

Rendered Markdown is generated under `rendered/` by default and should not be committed unless a project intentionally publishes generated output.

To view the full Layer Model, strict dependency rules, and single-responsibility guidelines for the core modules, please read [ARCHITECTURE.md](./ARCHITECTURE.md).

## Contributing

We welcome contributions! To build the project locally:

```sh
pnpm install
pnpm build
```

Please feel free to open issues or submit pull requests on our [GitHub Repository](https://github.com/stemdev-hub/cli).
You can find details about the release process in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE)
