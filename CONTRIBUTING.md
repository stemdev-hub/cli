# Contributing to Stem

Stem is an owner-led pnpm monorepo with a portable engine, Node.js CLI/MCP adapters, and a VS Code extension. Keep contributions small, typed, and aligned with the [architecture](docs/architecture.md), [repository instructions](AGENTS.md), and [governance](docs/governance.md).

## Workspace structure

| Package                | Work here for                                                                      | Guide                                                                |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/core`        | Pure parsing, graph traversal, validation, rendering and supplied-project analysis | [Core README](packages/core/README.md)                               |
| `packages/cli`         | Node operations in `src/runtime/`, commands in `src/cli/`, server in `src/mcp/`    | [CLI README](packages/cli/README.md)                                 |
| `packages/vscode-stem` | Editor documents, live preview and workspace MCP setup                             | [Extension contribution guide](packages/vscode-stem/CONTRIBUTING.md) |

## Development

Use Node.js 22 or later at a patch level supported by the pnpm version declared in root `package.json`. Start with `pnpm install --frozen-lockfile`. The recursive `pnpm build` follows workspace dependencies; build core before building the CLI in isolation. Target a package with `pnpm --filter <package-name> build`, `test` or `typecheck`.

## Verification

Run checks relevant to the change and those required by the applicable package instructions. The full repository profile is:

```sh
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm depcruise
pnpm --filter @stemdev/cli smoke:built-cli
node scripts/check-doc-budgets.mjs
pnpm test:docs
pnpm docs:check
git diff --check
```

For prose/navigation changes, `pnpm docs:check --static`, budgets and whitespace checks provide a quick profile; review meaning, authority and affected examples as well. The full documentation check needs built core/CLI declarations. It compares generated API output in a temporary directory and executes selected examples from the documents themselves. To update the generated CLI reference intentionally, run `pnpm --filter @stemdev/cli docs:types` and review the result.

Documentation checks exclude designated parser/consumer fixtures from navigation expectations. They do not certify every external link, GitHub rendering, prose claim, editor host, or released artifact. Generated API signatures belong to source types/TSDoc; do not hand-edit the declaration rollup. TSDoc metadata is generated into ignored `dist/`, not maintained as a package-root source file.

To package an extension candidate after building:

```sh
pnpm --filter vscode-stem exec vsce package --no-dependencies --out <absolute-temporary-vsix-path>
```

Inspect the bundled entry/assets and exclusions; follow the [host checklists](packages/vscode-stem/CONTRIBUTING.md#manual-test-checklist). Mocked tests and packaging do not prove editor integration. Record actual host version and results separately.

For package consumer checks, pack core and CLI into an isolated temporary directory, run `node scripts/check-packed-core.mjs <core-tarball>` and `node scripts/verify-release-tarball.mjs <tarball>`, then install the exact tarballs in a clean consumer. Verify public ESM imports, dependency resolution, executable discovery, `stem --help` and a disposable `stem init`/create/check workflow. Use placeholders only after choosing real paths; do not run sample initialization in a real project.

Record baseline, changed scope, commands/results, platform, candidate identity and remaining limits. Keep temporary consumers/VSIX files outside maintained source. Sandboxed access failures may need approved broader execution; they are not passing checks.

## Contribution rules

Follow [binding rules](docs/rules.md) and [ADR-0001](docs/decisions/0001-extract-core-package.md). Portable logic belongs in core; Node I/O/orchestration belongs in CLI; editor integration belongs in the extension. Use public package entries and type-only imports where appropriate.

Keep validation read-only. Follow the documented [configuration](packages/cli/README.md#configuration) and [namespace-snapshot policies](docs/reference.md#namespace-snapshots) when locating persisted caches. [Governance](docs/governance.md) defines significant-change ADR thresholds, accepted-specification maintenance, protected files and summaries. Use the repository documentation skill for documentation work. Update owning guidance with behavior and roadmap when work state changes.

## Contribution workflow

1. Select a bounded outcome and approved file scope; inspect current Git state and applicable instructions. Preserve unrelated work.
2. Implement that outcome with its owning documentation. Record adjacent discoveries separately; obtain approval before expanding scope.
3. Run targeted acceptance and required checks, including the [documentation consistency review](#documentation-consistency-review) when applicable. Review the complete diff, generated output and lockfile for unintended changes.
4. Update affected roadmap work once, linking evidence. Acceptance requires its criteria to pass; source changes alone are insufficient.
5. Report results and limits. Staging, commits, publishing and publishing merges require their own authorization.

Completed evidence belongs in dated history when it remains useful. Rejected ideas retain reasons without occupying the active work list.

### Documentation consistency review

Apply this review to documentation changes and code changes that affect documented behavior:

- **Ownership:** Does each changed requirement have one canonical owner under [governance](docs/governance.md#where-does-a-fact-go), with detail appropriate to that document's purpose?
- **Impact:** Do affected current guides, summaries, examples and agent instructions agree with the owning content? Check references to changed terms, commands, settings and statuses; useful linked summaries need not be removed.
- **Applicability:** Are proposed design, accepted design, implementation, host acceptance and released behavior distinguished? Treat historical records and intentional fixtures according to their purpose rather than rewriting them as current guidance.
- **Evidence:** Do claims match the relevant decisions, implementation/tests or release evidence? Run the appropriate [verification profile](#verification) and state remaining uncertainty; passing automated checks alone does not establish semantic consistency.

For an audit, report the inspected scope and exclusions. For a bounded change, report affected-document coverage and unresolved findings without implying that the entire repository was audited.

## Design documentation

[Architecture](docs/architecture.md#current-decision-applicability) maps applicable decisions and specifications. ADRs explain significant choices; specifications own precise contracts; the [current reference](docs/reference.md) describes implemented user semantics. Pure Block/connection design is accepted; implementation still follows a bounded file scope and resolves the selected slice's open mechanics.

Use [governance](docs/governance.md#decision-lifecycle) for acceptance, rejection, withdrawal and supersession. Review proposals, applicability and deferred triggers at releases, or quarterly when releases pause. Routine compatible API additions and editorial changes do not automatically need new ADRs; removals/renames of core exports still do.

## Support and participation

Use the repository [issue tracker](https://github.com/stemdev-hub/cli/issues) for reproducible bugs and usage questions. Include package versions, Node/editor/OS versions, the command or editor action, minimal Markdown/configuration, expected versus actual behavior, and relevant diagnostics. Remove credentials and unrelated private content from reproductions.

Support and review are owner-led and best effort; there is no response-time commitment. Discuss substantial proposals before implementing them. Be respectful, criticize ideas rather than people, and help others reproduce the issue.

A monitored private security-reporting route has not yet been selected; do not assume a private channel or response promise exists. That owner decision and triggers for additional community files are tracked in [roadmap](roadmap.md#documentation-and-community-adoption).

## Commit messages

Follow Conventional Commits with concise scopes, for example `fix(parser): preserve escaped references` or `docs(cli): explain namespace snapshots`.

## Release process

The [release workflow](.github/workflows/release-please.yml) uses Release Please and npm OIDC trusted publishing. Review a concrete candidate and obtain separate owner authorization before a publishing merge or publication. [R10](roadmap.md#r10-verify-an-authorized-release-delivers-selected-fixes) owns outstanding consumer verification.

- Release Please maintains package versions/changelogs. Keep source versions, local tags, candidate artifacts, host acceptance and verified distribution distinct.
- Stable releases publish core before a dependent CLI, verify tarball dependency ranges, and attach the extension VSIX to its GitHub release. This does not establish Marketplace publication.
- Other pushes to `main` can publish npm `next` canaries and upload VSIX artifacts. Treat such merges as publishing actions.
- Use local tarballs and temporary VSIX candidates for checks. Re-run `npm audit --omit=dev` on the exact packed consumer before a release; historical advisory investigations are not current clearance.
- Preserve the configured release workflow identity; review trusted-publisher settings before repository/workflow renames.
- Record actual consumer versions/artifact identities and host results. Do not publish packages merely to test documentation.
