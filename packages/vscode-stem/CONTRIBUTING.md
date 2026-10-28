# Contributing to Stem VS Code Extension

## How Preview Works (Architecture)

Open a Markdown source under `blocksDir` and run `Stem: Open Preview to Side`. The extension:

1. Selects the active source URI without requiring frontmatter metadata.
2. Finds the nearest `.stem/config.json`.
3. Captures unsaved source/configuration buffers, loads disk sources and analyzes them with bundled core.
4. Serves exact composition content through a readonly `stem-preview:` document, with diagnostics in
   the separate Stem Preview Diagnostics output channel.
5. Opens that virtual document in VS Code's native Markdown preview.

Relevant disk/buffer/configuration changes invalidate content and diagnostics together, even with
auto-refresh off. Later evaluation rejects obsolete results; it cannot return cached content as current.
Preview performs no writes and never spawns CLI. Core supplies all parsing and composition semantics.
See [architecture](https://github.com/stemdev-hub/cli/blob/main/docs/architecture.md#editor-adapter).

## Manual Test Checklist

Record host name/version, trust state, fixture and results; automated tests do not establish host acceptance.

1. Open a source with surrounding text, nested Blocks and no frontmatter ID. Preview it.
2. Edit a referenced Block and the active source without saving; verify exact current content.
3. Edit configuration without saving, including `blocksDir`, invalid identity and an unknown key.
   Confirm errors appear separately and disk files remain unchanged.
4. Introduce a missing inclusion, a cycle and a low work/output limit. Verify partial content and scoped
   diagnostics; fix the source and ensure stale content/diagnostics disappear together.
5. Turn auto-refresh off, edit/delete a source and confirm the previous result is invalidated.
   Manually refresh. Trigger overlapping slow evaluations and ensure the older result cannot replace it.
6. Change files in two projects and confirm only the affected project is invalidated.
7. Close the last preview and confirm watchers stop; try an untrusted workspace and confirm preview refuses.
8. Verify original frontmatter, whitespace, BOM and final-newline behavior in the virtual document.
   Native Markdown presentation may visually format these bytes.
9. Verify source-boundary rejection for an outside file and a symlink escaping `blocksDir`.

Preview requires no CLI installation. The separate server uses
[MCP setup and CLI discovery](README.md#ai-context-server-mcp).

## MCP Validation

The [MCP usage guide](README.md#ai-context-server-mcp) defines destinations, CLI selection, preservation, JSONC refusal, and explicit legacy repair. Use disposable workspace fixtures and separate temporary editor user-data/extensions directories; never test against your real configuration.

From the repository root, with the pinned pnpm version and existing dependencies:

```sh
pnpm --filter vscode-stem build
pnpm --filter vscode-stem exec vitest run tests/vscode-stem.test.ts
```

The command tests use real temporary files and mocked executable probing, with actual Windows shim invocations on Windows. They cover explicit/relative/PATH CLI settings, JavaScript entries, failed probes, fallback, spaces and shell metacharacters, alongside both host formats, preservation, legacy repair, trust, dirty buffers, concurrent writes and write failures. Run the shared [code validation profile](../../CONTRIBUTING.md#verification), including CLI tests, and package a temporary VSIX. These checks do not prove editor integration.

For real-host validation, resolve absolute temporary paths for the candidate VSIX, fixture workspace, and each editor's user-data/extensions directories. Install with `code --user-data-dir <data> --extensions-dir <extensions> --install-extension <vsix>` and open with the same isolation flags plus `--new-window <fixture>`; repeat using `cursor`. Verify that no home-global MCP source is being used. Record exact editor/CLI versions, source SHA, VSIX SHA-256 and platform.

1. **Configuration recognition:** invoke Stem setup, inspect both workspace files, and confirm each editor lists Stem from its own expected file. Repeat with existing unrelated servers, legacy output, JSONC, and a two-folder workspace. Configuration recognition is separate from server startup.
2. **Startup:** start Stem through the editor's MCP controls, inspect MCP output, confirm initialization/tool discovery, and use a harmless read-only tool against the fixture. Record trust or organizational-policy restrictions without bypassing them.
3. **CLI discovery:** use fresh fixture entries for an explicit executable, JavaScript entry, Windows `.cmd` shim, and PATH installation, including paths with spaces. Confirm setup probes `--help`, then start the generated entry without substitutions. An invalid explicit setting must notify without writing configuration; empty settings with no working PATH CLI must produce the npx fallback. Changing the setting preserves existing valid entries as described in the usage guide. Record real process results separately from mocks and editor recognition.
4. **Coverage:** check VS Code 1.101.x and an available newer build, plus Cursor with its exact version recorded. Verify remote file placement and process cwd when a remote host is available; otherwise record that limitation.
5. **Artifact:** inspect the VSIX's `extension/package.json`, `dist/extension.js`, assets and README, confirming source/test/fixture exclusions. Source checks and candidate inspection do not verify a published artifact; distribution remains under R10.

Both files are validated and staged before replacement. Each file is published whole, but the pair is not one atomic transaction. On a partial failure, follow the error's list of changed files and review before retrying; reverting extension code cannot restore user configuration. New-file publication requires filesystem hard-link support and fails safely if unavailable. Existing JSON can be reformatted; arbitrary external writers are not locked out by the baseline recheck.
