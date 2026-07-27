# Stem VS Code Extension

Preview Stem views in VS Code using Stem's CLI renderer and VS Code's built-in Markdown preview.

## Commands

- `Stem: Open Preview to Side`
- `Stem: Refresh Preview`

## How Preview Works

Open a Markdown view from a Stem project and run `Stem: Open Preview to Side`. The extension:

1. Reads the active file's frontmatter `id`.
2. Finds the nearest Stem project root by walking up to `.stem`.
3. Runs `stem preview view <view-id>` from that project.
4. Serves the rendered Markdown body through a readonly `stem-preview:` virtual document.
5. Opens that virtual document in VS Code's native Markdown preview.

The extension does not duplicate Stem parser or renderer logic, and it does not use a custom webview.
The CLI remains the source of truth; the preview only hides leading YAML frontmatter so the rendered document reads cleanly in VS Code.

Open previews refresh automatically when project files change:

- `views/**/*.md`
- `blocks/**/*.md`
- `blocks/schemas/**/*.{yaml,yml}`
- `.stem/config.json`

Refreshes are scoped to open Stem preview documents for the changed project. Use `Stem: Refresh Preview` to refresh all open Stem previews manually.

## Settings

- `stem.cliPath`: explicit Stem CLI executable path. Leave empty to use the workspace `dist/cli/index.js` when present, then the bundled repo CLI, then `stem` on `PATH`.
- `stem.preview.autoRefresh`: refresh open Stem previews when project files change. Defaults to `true`.
- `stem.preview.refreshDebounceMs`: debounce delay for file-change refreshes. Defaults to `250`.

## CLI Resolution

The extension resolves the CLI in this order:

1. `stem.cliPath` setting
2. `<workspace>/dist/cli/index.js`
3. bundled repo `dist/cli/index.js`
4. `stem` on `PATH`

Run `pnpm build` in this repo before testing the extension against the workspace CLI.

## Troubleshooting

- If preview cannot open, make sure the active editor is a Markdown file on disk inside a Stem project and has top-level frontmatter like `id: api-view`.
- If rendering fails, the preview shows Markdown with the failed command, project root, exit code when available, stdout/stderr, and a suggested next action.
- If the CLI cannot be found, set `stem.cliPath` to a `stem` executable or JavaScript CLI entrypoint. JavaScript entrypoints are run with VS Code's Node runtime.
- If auto-refresh feels too eager or too slow, adjust `stem.preview.refreshDebounceMs`.
- If auto-refresh is disabled, run `Stem: Refresh Preview` from the Command Palette or from a Stem preview editor title.

## Manual Test Checklist

1. Open a Markdown view from a Stem project and run `Stem: Open Preview to Side`.
2. Edit and save a referenced block; the preview should refresh.
3. Edit and save the source view; the preview should refresh.
4. Introduce a broken block reference; the preview should show a Markdown-formatted Stem error.
5. Set `stem.cliPath` to a specific CLI executable and confirm it takes precedence.
6. Disable `stem.preview.autoRefresh`, edit a referenced file, and confirm manual refresh still works.
7. Re-enable `stem.preview.autoRefresh` without reloading VS Code and confirm changes refresh again.
8. In a multi-root workspace, open previews from two Stem projects and confirm edits refresh only the matching project's previews.
