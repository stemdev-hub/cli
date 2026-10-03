# packages/vscode-stem

<!-- Fill from packages/vscode-stem/package.json. Only real commands. -->

- build: `<fill>`
- test: `<fill>`
- lint/typecheck: `<fill>`

Run build, test, and typecheck before calling a change done.
Never reimplement parsing or graph logic here. It will come from @stemdev/core (ADR-0001); until then the extension calls the CLI.
