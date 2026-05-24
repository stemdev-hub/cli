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
stem add auth-flow-block to auth-service-view --section auth-flow --tag summary
stem check
stem sync
```

## Architecture

The CLI is intentionally thin. All business logic belongs in `src/core/`, and the public core API is exported from `src/index.ts` so future MCP servers, editor tools, and UI clients can import Stem without depending on CLI code.
