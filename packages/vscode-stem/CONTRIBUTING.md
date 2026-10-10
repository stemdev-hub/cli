# Contributing to Stem VS Code Extension

## How Preview Works (Architecture)

Open a Markdown view from a Stem project and run `Stem: Open Preview to Side`. The extension:

1. Parses the active buffer with the public `@stemdev/core` `parseViewFile` API and uses its decoded `id`, reporting invalid frontmatter before opening.
2. Finds the nearest Stem project root by walking up to `.stem`.
3. Loads project files through VS Code filesystem APIs, preferring open buffers, then analyzes and renders the selected view with bundled core.
4. Serves the rendered Markdown body through a readonly `stem-preview:` virtual document.
5. Opens that virtual document in VS Code's native Markdown preview.

The extension does not duplicate Stem parser or renderer logic, and it does not use a custom webview.
Core supplies parsing, validation, and rendering semantics. Preview is available only in trusted VS Code workspaces and does not spawn a CLI process.

Open previews refresh automatically when project files or unsaved buffers change, including:

- `views/**/*.md`
- `blocks/**/*.md`
- `blocks/schemas/**/*.{yaml,yml}`
- `.stem/config.json`

Preview requires no CLI installation or path configuration. For the separate AI server, see [MCP setup and its current CLI discovery limitations](README.md#ai-context-server-mcp).

## Manual Test Checklist

1. Open a Markdown view from a Stem project and run `Stem: Open Preview to Side`.
2. Edit a referenced block without saving; the preview should refresh. Save and confirm it still renders.
3. Edit the source view without saving; the preview should reflect the active buffer.
4. Introduce a broken block reference; the preview should show a Markdown-formatted Stem error.
5. Open views with `"id": "my-view"`, a `---yaml` opener, and `id: "api\u002dview"`; confirm the intended view renders. Try malformed YAML after a valid `id`, a missing ID, and a numeric ID; expect a useful notification and no new preview.
6. Disable `stem.preview.autoRefresh`, edit a referenced file, and confirm manual refresh still works.
7. Re-enable `stem.preview.autoRefresh` without reloading VS Code and confirm changes refresh again.
8. In a multi-root workspace, open previews from two Stem projects and confirm edits refresh only the matching project's previews.
9. In an untrusted workspace, confirm preview is refused. Close or refresh a preview during loading and confirm cancellation does not display an obsolete error.

Run the shared [code validation profile](../../roadmap.md#shared-task-requirements-and-validation), then `pnpm --filter vscode-stem exec vitest run tests/preview.test.ts tests/vscode-stem.test.ts`. Inspect a temporary VSIX for its bundled entry and exclusions. These automated checks use mocked VS Code APIs; record the exact editor version and results of this checklist separately for real-host acceptance.

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
