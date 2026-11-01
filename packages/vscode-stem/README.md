<div align="center">
  <h1>Stem for VS Code</h1>
  <p>Preview Stem sources natively in VS Code using bundled @stemdev/core.</p>

[![Version](https://img.shields.io/visual-studio-marketplace/v/stemdev.vscode-stem.svg?color=blue&label=VS%20Code)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/stemdev.vscode-stem.svg)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/stemdev.vscode-stem.svg)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
</div>

---

Stem is a Git-native, file-based documentation system for software developers. This extension provides a seamless, side-by-side live preview of your composed Stem Markdown sources directly inside your editor.

## Installation

Requires VS Code 1.101 or later. Install [Stem from the Marketplace](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem), or install a release VSIX using **Extensions: Install from VSIX**. See the [repository](https://github.com/stemdev-hub/cli) for the CLI and portable engine packages.

This guide describes the repository's Pure Block extension implementation. Marketplace availability is tracked in [R10](https://github.com/stemdev-hub/cli/blob/main/roadmap.md#r10-verify-an-authorized-release-delivers-selected-fixes); for an unreleased candidate, use the [local candidate verification procedure](https://github.com/stemdev-hub/cli/blob/main/CONTRIBUTING.md#verification).

See the [shared current reference](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md) for authoring semantics and known rendering/namespace limitations. The accepted Pure Block specifications govern the source model; source-connection resolution remains deferred.

## Features

- **Live Preview:** See your composed source files side-by-side as you type.
- **Auto-Refresh:** Previews automatically update when project files or unsaved editor contents change.
- **Native Rendering:** Uses VS Code's built-in Markdown preview window so your themes and styling match perfectly.
- **Error Reporting:** Keeps partial content in the preview and diagnostics in the separate Stem Preview Diagnostics output channel.

## Prerequisites

Preview includes `@stemdev/core`; no CLI installation is required. Open a trusted workspace containing
a Stem project with valid `.stem/config.json` and a required `projectId`. See the
[configuration procedure](https://github.com/stemdev-hub/cli/blob/main/packages/cli/README.md#configuration)
for establishing identity, and [MCP setup](#ai-context-server-mcp) for the separate AI context server requirements.

Preview uses the same configuration validation as the CLI, including for unsaved buffers. Missing or
invalid identity produces an error; correcting an unsaved configuration buffer allows preview to
resume without saving it. Opening or previewing a project never creates or repairs identity.

## Usage

1. Open a Markdown source beneath the project's configured `blocksDir`.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **`Stem: Open Preview to Side`**.
4. A preview window will open. Unsaved changes to sources or configuration also refresh the preview.

The active source URI selects the file. No frontmatter ID is needed, and frontmatter remains ordinary content. Composition preserves exact content and reports scoped diagnostics separately. Relevant changes invalidate content and diagnostics together, even with auto-refresh off; use manual refresh to evaluate again.

You can also manually refresh all open previews by running **`Stem: Refresh Preview`**.

## AI Context Server (MCP)

Open your initialized Stem project in a trusted workspace, then run **`Stem: Enable AI Context Server (MCP)`**. Setup configures both editors in the **first workspace folder**, including in a multi-root workspace:

| Editor  | Workspace file     | Stem entry        |
| ------- | ------------------ | ----------------- |
| VS Code | `.vscode/mcp.json` | `servers.stem`    |
| Cursor  | `.cursor/mcp.json` | `mcpServers.stem` |

That folder must contain saved, valid `.stem/config.json`. Setup validates it through bundled core before CLI discovery or writes. Missing, unreadable or invalid configuration stops setup with guidance; unsaved configuration must be saved or closed first because the MCP process reads disk. Open the intended project as the first folder, or explicitly initialize it with `stem init` before retrying. Setup never initializes or repairs project identity, and never selects a different workspace folder automatically. Configuration is rechecked after CLI discovery and before publishing each MCP file; changed inputs require a retry.

New entries use `type: "stdio"`. Setup preserves unrelated configuration and existing valid Stem customizations; it only adds a missing stdio type when appropriate. Repeated setup leaves an already configured file unchanged. User/profile/global configuration is not edited. Review the workspace files and use your editor's MCP controls to start the server; saving configuration does not prove successful startup.

Automatic setup accepts ordinary JSON. Missing or empty MCP configuration files are initialized. Invalid JSON, wrong-shaped values, and JSONC with comments/trailing commas are left untouched, with an error naming the file. VS Code supports JSONC, but this setup command does not edit it. Save or close dirty configuration buffers before retrying. For manual setup, merge this entry under the editor-specific key above, preserving other entries:

```json
"stem": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@stemdev/cli@latest", "mcp"],
  "cwd": "/absolute/path/to/your/workspace-folder"
}
```

For configurations written by older Stem versions, explicitly rerun the command. It moves an exact, uncustomized legacy `.vscode/mcp.json` `mcpServers.stem` entry to `servers.stem`. Customized, conflicting, or different-folder entries require a manual merge; unrelated legacy entries are retained. Back up the file before a manual repair. Opening a project or updating the extension never performs this repair automatically.

MCP setup chooses the CLI in this order:

1. A nonempty `stem.cliPath`: an absolute path, a path relative to the first workspace folder, or a command name on PATH. Supply only the executable or JavaScript entrypoint, without arguments or surrounding quotes. Spaces in paths are supported. A missing file, directory, or failed `--help` probe stops setup with an actionable error; it never silently switches to npx.
2. With an empty setting, a working `stem` on the extension host's PATH, checked using `--help` (supported by CLI 0.3.0). Broken candidates are skipped.
3. Only if neither is available, `npx -y @stemdev/cli@latest mcp` as shown above. This fallback can download the CLI and requires npm/network access when it is not cached.

Native executables run directly. JavaScript entries run through Node; if the editor runtime is needed, the saved entry includes `ELECTRON_RUN_AS_NODE`. Windows `.cmd`/`.bat` shims run through `cmd.exe` with an environment variable preserving the quoted path. Keep the generated `command`, `args`, and `env` together when editing these entries. Preview continues to use bundled core.

Discovery supplies new entries; existing valid Stem entries remain preserved. After changing `stem.cliPath`, review an existing entry manually or remove only that entry and rerun setup to regenerate it. See the [MCP validation checklist](https://github.com/stemdev-hub/cli/blob/main/packages/vscode-stem/CONTRIBUTING.md#mcp-validation) for configuration recognition versus startup checks.

## Extension Settings

This extension contributes the following settings:

| Setting                          | Default | Description                                                                                                 |
| -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `stem.cliPath`                   | `""`    | CLI executable or JavaScript entrypoint for [MCP setup](#ai-context-server-mcp). Preview uses bundled core. |
| `stem.preview.autoRefresh`       | `true`  | Automatically refresh open previews when project files or unsaved editor contents change.                   |
| `stem.preview.refreshDebounceMs` | `250`   | Debounce delay in milliseconds before refreshing open previews after a file change.                         |

`stem.preview.maxWork` and `stem.preview.maxOutputBytes` override the [shared composition limits](https://github.com/stemdev-hub/cli/blob/main/docs/specs/composition.md#d24-resource-budgets). Both accept nonnegative safe integers, including zero. Invalid values are diagnosed rather than clamped.

## Troubleshooting

- **Preview doesn't open?** Ensure the active editor is a Markdown file saved on disk beneath `blocksDir` inside a project with valid `.stem/config.json`.
- **Configuration error?** Supply a valid `projectId` and supported settings. Configuration has no `version` field. Restore a lost configuration from version control to retain the project's identity.
- **Partial or blank preview?** Read the Stem Preview Diagnostics output channel, correct the indicated source/configuration, then refresh.
- **Workspace Untrusted?** Stem preview is available only in trusted workspaces. Trust the workspace in VS Code before opening a Stem preview.
- **Preview refreshes too slow/fast?** Adjust the `stem.preview.refreshDebounceMs` setting in your VS Code preferences.

## Contributing

Are you a developer looking to contribute to the extension? Please see our [Contributing Guide](https://github.com/stemdev-hub/cli/blob/main/packages/vscode-stem/CONTRIBUTING.md) for architecture details and validation checklists.

## License

[MIT](https://github.com/stemdev-hub/cli/blob/main/LICENSE)
