# packages/vscode-stem

- No build/test/typecheck scripts; the extension is plain `extension.js`.
- Tests live in `packages/cli/tests/extensions`; run with `pnpm --filter @stemdev/cli test`.
- Package: `pnpm --filter vscode-stem exec vsce package`.
- Root `pnpm lint` ignores the extension's JS.

Run the CLI extension tests and package the VSIX before calling a change done.
Never reimplement parsing or graph logic here. It will come from @stemdev/core (ADR-0001); until then the extension calls the CLI.
