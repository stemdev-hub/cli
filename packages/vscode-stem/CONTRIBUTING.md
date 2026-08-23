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
