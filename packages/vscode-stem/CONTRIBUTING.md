# Contributing to Stem VS Code Extension

## How Preview Works (Architecture)

Open a Markdown view from a Stem project and run `Stem: Open Preview to Side`. The extension:

1. Reads the active file's frontmatter `id`.
2. Finds the nearest Stem project root by walking up to `.stem`.
3. Runs `stem preview view <view-id>` from that project.
4. Serves the rendered Markdown body through a readonly `stem-preview:` virtual document.
5. Opens that virtual document in VS Code's native Markdown preview.

The extension does not duplicate Stem parser or renderer logic, and it does not use a custom webview.
The CLI remains the source of truth; the preview only hides leading YAML frontmatter so the rendered document reads cleanly in VS Code.
Because preview runs the Stem CLI from the project root, it is available only in trusted VS Code workspaces.

Open previews refresh automatically when project files change:

- `views/**/*.md`
- `blocks/**/*.md`
- `blocks/schemas/**/*.{yaml,yml}`
- `.stem/config.json`

## CLI Resolution

The extension resolves the CLI in this order:

1. `stem.cliPath` setting
2. `<workspace>/dist/cli/index.js`
3. bundled repo `dist/cli/index.js`
4. `stem` on `PATH`

Run `pnpm build` in the monorepo root before testing the extension against the workspace CLI.

## Manual Test Checklist

1. Open a Markdown view from a Stem project and run `Stem: Open Preview to Side`.
2. Edit and save a referenced block; the preview should refresh.
3. Edit and save the source view; the preview should refresh.
4. Introduce a broken block reference; the preview should show a Markdown-formatted Stem error.
5. Set `stem.cliPath` to a specific CLI executable and confirm it takes precedence.
6. Disable `stem.preview.autoRefresh`, edit a referenced file, and confirm manual refresh still works.
7. Re-enable `stem.preview.autoRefresh` without reloading VS Code and confirm changes refresh again.
8. In a multi-root workspace, open previews from two Stem projects and confirm edits refresh only the matching project's previews.

## MCP Validation

The [MCP usage guide](README.md#ai-context-server-mcp) defines destinations, preservation, JSONC refusal, and explicit legacy repair. Use disposable workspace fixtures and separate temporary editor user-data/extensions directories; never test against your real configuration. The CLI discovery behavior remains the responsibility of [R03](https://github.com/stemdev-hub/cli/blob/main/roadmap.md#r03-resolve-the-configured-or-installed-cli-without-relying-on-version).

From the repository root, with the pinned pnpm version and existing dependencies:

```sh
pnpm --filter vscode-stem build
pnpm --filter vscode-stem exec vitest run tests/vscode-stem.test.ts
```

The command tests use real temporary files and mocked executable probing. They cover both host formats, empty files, customizations, idempotence, unsafe input, explicit legacy repair/conflicts, trust, first-folder targeting, dirty buffers, concurrent writes, staging/replacement failures and partial results. They do not prove editor integration. Run the shared [code validation profile](../../roadmap.md#shared-task-requirements-and-validation), including CLI tests, and package a temporary VSIX before completing R02.

For real-host validation, resolve absolute temporary paths for the candidate VSIX, fixture workspace, and each editor's user-data/extensions directories. Install with `code --user-data-dir <data> --extensions-dir <extensions> --install-extension <vsix>` and open with the same isolation flags plus `--new-window <fixture>`; repeat using `cursor`. Verify that no home-global MCP source is being used. Record exact editor/CLI versions, source SHA, VSIX SHA-256 and platform.

1. **Configuration recognition:** invoke Stem setup, inspect both workspace files, and confirm each editor lists Stem from its own expected file. Repeat with existing unrelated servers, legacy output, JSONC, and a two-folder workspace. Configuration recognition is separate from server startup.
2. **Startup:** start Stem through the editor's MCP controls, inspect MCP output, confirm initialization/tool discovery, and use a harmless read-only tool against the fixture. Record trust or organizational-policy restrictions without bypassing them.
3. **R03 isolation:** if the generated executable fails, record that failure first. In the disposable fixture only, substitute an available Node executable and the built CLI entry to check host transport/cwd independently. Success after substitution does not validate unmodified setup end to end.
4. **Coverage:** check VS Code 1.101.x and an available newer build, plus Cursor with its exact version recorded. Verify remote file placement and process cwd when a remote host is available; otherwise record that limitation.
5. **Artifact:** inspect the VSIX's `extension/package.json`, `dist/extension.js`, assets and README, confirming source/test/fixture exclusions. Source checks and candidate inspection do not verify a published artifact; distribution remains under R10.

Both files are validated and staged before replacement. Each file is published whole, but the pair is not one atomic transaction. On a partial failure, follow the error's list of changed files and review before retrying; reverting extension code cannot restore user configuration. New-file publication requires filesystem hard-link support and fails safely if unavailable. Existing JSON can be reformatted; arbitrary external writers are not locked out by the baseline recheck.
