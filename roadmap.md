# Stem Roadmap

This document outlines the post-MVP roadmap for Stem, starting with foundational core updates and moving towards major AI and web integrations.

## Phase 1: Foundational Core Updates

These are internal architecture improvements to prepare the codebase for complex integrations without breaking existing functionality.

- [x] **Namespace Syntax:** Update ID validation to accept namespaces (e.g., `@stem[block:my-repo:auth-flow]`). This is the necessary groundwork for cross-project references.
- [x] **Cross-Project References:** Implement `stem publish-graph` and `stem fetch-namespaces` CLI commands to safely map, cache, and validate structural snapshots across different repositories.
- [ ] **Machine-Readable CLI Output:** Add a `--json` flag to commands like `stem check` and `stem list` to output structured JSON arrays, enabling trivial CI/CD integration.

## Phase 2: Major Integrations

These features fulfill Stem's core mission: bridging the gap between active code and AI coding agents.

- [ ] **MCP Server (Model Context Protocol):** Build the `stem mcp` command to expose the dynamic graph and blocks directly to AI agents (like Claude and Cursor). This allows AIs to intelligently navigate the codebase context.
- [ ] **Live Code References:** Implement the `@stem[code:path/to/file.ts#L10-L20]` directive, allowing blocks to transclude real source code that updates automatically, solving documentation staleness.

## Phase 3: Publishing and User Interface

Features focused on human readability and distribution.

- [ ] **HTML Export & Publishing:** Add an HTML pipeline to generate static websites from the Markdown, and create a GitHub Action for automated publishing.
- [ ] **Web UI:** Build a local server (`stem serve`) to visually browse the connection graph (e.g., using D3.js or React Flow) and read views in a browser.

## Phase 4: Advanced Graph Features

- [ ] **Localization:** Support for fallback view/block resolution (e.g., falling back to `en` if `es` is missing).
- [ ] **External Sources:** Pulling OpenAPI specs or GraphQL schemas as virtual blocks.
