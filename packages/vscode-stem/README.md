<div align="center">
  <h1>Stem for VS Code</h1>
  <p>Preview Stem views natively in VS Code using bundled @stemdev/core.</p>

[![Version](https://img.shields.io/visual-studio-marketplace/v/stemdev.vscode-stem.svg?color=blue&label=VS%20Code)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/stemdev.vscode-stem.svg)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/stemdev.vscode-stem.svg)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
</div>

---

Stem is a Git-native, file-based documentation system for software developers. This extension provides a seamless, side-by-side live preview of your composed Stem Markdown views directly inside your editor.

## Installation

Requires VS Code 1.101 or later. Install [Stem from the Marketplace](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem), or install a release VSIX using **Extensions: Install from VSIX**. See the [repository](https://github.com/stemdev-hub/cli) for the CLI and portable engine packages.

## Features

- **Live Preview:** See your rendered Stem views side-by-side as you type.
- **Auto-Refresh:** Previews automatically update when project files or unsaved editor contents change.
- **Native Rendering:** Uses VS Code's built-in Markdown preview window so your themes and styling match perfectly.
- **Error Reporting:** Instantly displays markdown-formatted error logs if you have broken block references or syntax errors.

## Prerequisites

Preview includes `@stemdev/core`; no CLI installation is required. Open a trusted workspace containing a Stem project with a `.stem` folder. See [MCP setup](#ai-context-server-mcp) for the separate AI context server requirements.

## Usage

1. Open a Markdown view from a Stem project.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **`Stem: Open Preview to Side`**.
4. A preview window will open. Unsaved changes to the view or its referenced blocks also refresh the preview.

View selection uses core's YAML frontmatter semantics, including quoted keys and IDs, `---yaml` openers, and Unicode escapes such as `id: "api\u002dview"`. Invalid YAML or a missing string `id` produces a notification; correct the active buffer and rerun the command.

You can also manually refresh all open previews by running **`Stem: Refresh Preview`**.

## AI Context Server (MCP)

In a trusted workspace, run **`Stem: Enable AI Context Server (MCP)`**. Setup configures both editors in the **first workspace folder**, including in a multi-root workspace:

| Editor  | Workspace file     | Stem entry        |
| ------- | ------------------ | ----------------- |
| VS Code | `.vscode/mcp.json` | `servers.stem`    |
| Cursor  | `.cursor/mcp.json` | `mcpServers.stem` |

New entries use `type: "stdio"`. Setup preserves unrelated configuration and existing valid Stem customizations; it only adds a missing stdio type when appropriate. Repeated setup leaves an already configured file unchanged. User/profile/global configuration is not edited. Review the workspace files and use your editor's MCP controls to start the server; saving configuration does not prove successful startup.

Automatic setup accepts ordinary JSON. Missing or empty files are initialized. Invalid JSON, wrong-shaped values, and JSONC with comments/trailing commas are left untouched, with an error naming the file. VS Code supports JSONC, but this setup command does not edit it. Save or close dirty configuration buffers before retrying. For manual setup, merge this entry under the editor-specific key above, preserving other entries:

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

## Troubleshooting

- **Preview doesn't open?** Ensure the active editor is a Markdown file saved on disk inside a valid Stem project (must have a `.stem` folder) and contains a frontmatter `id`.
- **Invalid view notification?** Fix the YAML frontmatter and supply a nonempty string `id`, then reopen the preview.
- **Workspace Untrusted?** Stem preview is available only in trusted workspaces. Trust the workspace in VS Code before opening a Stem preview.
- **Preview refreshes too slow/fast?** Adjust the `stem.preview.refreshDebounceMs` setting in your VS Code preferences.

## Contributing

Are you a developer looking to contribute to the extension? Please see our [Contributing Guide](https://github.com/stemdev-hub/cli/blob/main/packages/vscode-stem/CONTRIBUTING.md) for architecture details and validation checklists.

## License

[MIT](https://github.com/stemdev-hub/cli/blob/main/LICENSE)
