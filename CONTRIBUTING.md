# Contributing to Stem

Stem is organized as a TypeScript Node.js CLI with a reusable core library. Please keep contributions small, typed, and aligned with the module boundaries below.

## Module Structure

- `src/cli/`: command registration and terminal output only.
- `src/core/fs/`: project discovery, file scanning, reads, and writes.
- `src/core/config/`: `.stem/config.json` loading, defaults, and config path normalization.
- `src/core/parser/`: frontmatter parsing, `@stem[]` parsing, and two-pass section/tag resolution.
- `src/core/graph/`: in-memory graph construction and traversal.
- `src/core/cache/`: cache index, graph snapshots, and hybrid stat plus SHA invalidation.
- `src/core/operations/`: orchestration for CLI commands.
- `src/core/validator/`: schema validation and structural rules.
- `src/core/types/`: shared type definitions only.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm smoke:built-cli
```

In some sandboxed environments, `pnpm build` can fail when esbuild scans parent directories and hits filesystem access denial. Rerun the build with broader filesystem access before treating that failure as a code or bundling issue.

## Contribution Rules

- Keep the CLI as a thin shell over `src/core/operations/`.
- Do not introduce runtime imports from `src/cli/` into `src/core/`.
- Use `import type` for type-only imports across modules.
- Keep validation read-only.
- Never write the dynamic graph into source files; cache output belongs under `.stem/cache/`.
- Update `docs/decisions.md` whenever a major architecture or product decision changes.

## Commit Messages

Follow conventional commits:

- `feat:` - new feature or capability.
- `fix:` - bug fix.
- `chore:` - tooling, dependencies, or configuration.
- `docs:` - documentation only.
- `test:` - tests only.
- `refactor:` - code changes with no intended behavior change.

Keep messages short and specific. Reference the affected module when useful, for example `feat(parser): add two-pass section resolution`.

## Architecture and Module Rules

Stem is deliberately layered. Every module has one job and a narrow set of allowed dependencies. Treat these boundaries as part of the public design of the project: they make changes easier to test, review, and extend.

To view the full Layer Model, strict dependency rules, and single-responsibility guidelines for the core modules, please read [ARCHITECTURE.md](./ARCHITECTURE.md).

## Release Process

Stem uses Google's `release-please-action` combined with OIDC Trusted Publishing to fully automate NPM releases.

1. **Merge PRs Normally:** Ensure your PR titles follow Conventional Commits (e.g., `feat:`, `fix:`).
2. **Review the Release PR:** A bot will automatically maintain an open "Release PR" (e.g., `chore: release v0.1.1`). It calculates the next version and compiles a `CHANGELOG.md` based on your merged PRs.
3. **Merge to Publish:** When you are ready to publish, simply merge the bot's "Release PR". The `.github/workflows/release-please.yml` pipeline will automatically tag the release, build the project, and publish it to NPM securely via OIDC.

### Staging & Pre-releases

If you need to test integrations (like VS Code extensions or CLI commands) without affecting the production `latest` tag:

- **NPM (CLI):** Publish locally or via an ad-hoc workflow using the `next` tag:
  ```bash
  npm publish --tag next
  ```
  Users can then test via `npm install @stemdev/cli@next`.
- **VS Code Extension:** Do not publish to the marketplace. Instead, package the extension locally into a `.vsix` file:
  ```bash
  cd packages/vscode-stem
  vsce package
  ```
  You can then drag and drop the `.vsix` file directly into your VS Code window to install and test the local build.
