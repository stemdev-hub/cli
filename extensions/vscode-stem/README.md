# Stem VS Code Extension

This is the MVP editor preview for Stem views.

## Commands

- `Stem: Open Preview to Side`
- `Stem: Refresh Preview`

Open a Markdown view from a Stem project, run `Stem: Open Preview to Side`, and the extension renders the view through the Stem CLI before handing the resolved Markdown to VS Code's built-in Markdown preview.

## CLI Resolution

The extension resolves the CLI in this order:

1. `stem.cliPath` setting
2. `<workspace>/dist/cli/index.js`
3. bundled repo `dist/cli/index.js`
4. `stem` on `PATH`

Run `pnpm build` in this repo before testing the extension against the workspace CLI.
