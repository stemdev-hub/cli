<div align="center">
  <h1>Stem for VS Code</h1>
  <p>Preview Stem views natively in VS Code using the Stem CLI renderer.</p>

[![Version](https://img.shields.io/visual-studio-marketplace/v/stemdev.vscode-stem.svg?color=blue&label=VS%20Code)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/stemdev.vscode-stem.svg)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/stemdev.vscode-stem.svg)](https://marketplace.visualstudio.com/items?itemName=stemdev.vscode-stem)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
</div>

---

Stem is a Git-native, file-based documentation system for software developers. This extension provides a seamless, side-by-side live preview of your composed Stem Markdown views directly inside your editor.

> **Note:** A placeholder for an animated GIF demonstrating the preview functionality goes here.

## ✨ Features

- **Live Preview:** See your rendered Stem views side-by-side as you type.
- **Auto-Refresh:** Previews automatically update whenever you save a referenced block, view, schema, or configuration file.
- **Native Rendering:** Uses VS Code's built-in Markdown preview window so your themes and styling match perfectly.
- **Error Reporting:** Instantly displays markdown-formatted error logs if you have broken block references or syntax errors.

## 🚀 Prerequisites

This extension is a UI wrapper around the Stem CLI. You must have the CLI installed on your machine for the extension to render your views.

```sh
npm install -g @stemdev/cli
```

## 📖 Usage

1. Open a Markdown view from a Stem project.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **`Stem: Open Preview to Side`**.
4. A preview window will open. As you edit and save the view or its referenced blocks, the preview will automatically refresh!

You can also manually refresh all open previews by running **`Stem: Refresh Preview`**.

## ⚙️ Extension Settings

This extension contributes the following settings:

| Setting                          | Default | Description                                                                                                                                 |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `stem.cliPath`                   | `""`    | Explicit path to the Stem CLI executable. If left empty, it will use your local workspace install, and then fallback to your global `PATH`. |
| `stem.preview.autoRefresh`       | `true`  | Automatically refresh open previews when project files (`views/**/*.md`, `blocks/**/*.md`, etc.) are saved.                                 |
| `stem.preview.refreshDebounceMs` | `250`   | Debounce delay in milliseconds before refreshing open previews after a file change.                                                         |

## 🛠 Troubleshooting

- **Preview doesn't open?** Ensure the active editor is a Markdown file saved on disk inside a valid Stem project (must have a `.stem` folder) and contains a frontmatter `id`.
- **"CLI not found" error?** Make sure you ran `npm install -g @stemdev/cli`. If it still fails, explicitly set the `stem.cliPath` setting to your global executable.
- **Workspace Untrusted?** Because the preview runs the Stem CLI from the project root, VS Code must trust the workspace. Trust the workspace in VS Code before opening a Stem preview.
- **Preview refreshes too slow/fast?** Adjust the `stem.preview.refreshDebounceMs` setting in your VS Code preferences.

## 🤝 Contributing

Are you a developer looking to contribute to the extension? Please see our [Contributing Guide](CONTRIBUTING.md) for architecture details, manual test checklists, and CLI resolution logic.
