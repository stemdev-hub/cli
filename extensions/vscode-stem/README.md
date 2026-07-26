# Stem VS Code Extension

This is the MVP editor preview for Stem views.

## Commands

- `Stem: Open Preview to Side`
- `Stem: Refresh Preview`

Open a Markdown view from a Stem project, run `Stem: Open Preview to Side`, and the extension renders the view through the Stem CLI before handing the resolved Markdown to VS Code's built-in Markdown preview.

Open previews refresh automatically when Stem view, block, schema, or config files change. Use `Stem: Refresh Preview` to force-refresh all open Stem previews.

## Settings

- `stem.cliPath`: explicit Stem CLI executable path. Leave empty to use the workspace `dist/cli/index.js` when present, then fall back to `stem` on `PATH`.
- `stem.preview.autoRefresh`: refresh open Stem previews when project files change. Defaults to `true`.
- `stem.preview.refreshDebounceMs`: debounce delay for file-change refreshes. Defaults to `250`.

## CLI Resolution

The extension resolves the CLI in this order:

1. `stem.cliPath` setting
2. `<workspace>/dist/cli/index.js`
3. bundled repo `dist/cli/index.js`
4. `stem` on `PATH`

Run `pnpm build` in this repo before testing the extension against the workspace CLI.

## Manual Test Checklist

1. Open a Markdown view from a Stem project and run `Stem: Open Preview to Side`.
2. Edit and save a referenced block; the preview should refresh.
3. Edit and save the source view; the preview should refresh.
4. Introduce a broken block reference; the preview should show a Markdown-formatted Stem error.
5. Set `stem.cliPath` to a specific CLI executable and confirm it takes precedence.
6. Disable `stem.preview.autoRefresh`, edit a referenced file, and confirm manual refresh still works.
