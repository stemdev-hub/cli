# @stemdev/cli

Node.js operations, terminal commands and a read-only MCP server for Stem Blocks and Tags.
Use [the shared reference](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md) for semantics
and [generated declarations](https://github.com/stemdev-hub/cli/blob/main/packages/cli/docs/stem-api.d.ts)
for the Node API.

## Installation

Requires Node.js 22 or later.

```sh
npm install -g @stemdev/cli
stem --help
```

## Author a project

```sh
stem init
stem create block welcome --file blocks/guide.md --tag guide
stem create block detail --parent welcome
stem add detail to file blocks/guide.md
stem list blocks --json
stem list references detail --json
stem check --json
stem preview block welcome
stem preview file blocks/guide.md
stem render block welcome --stdout
```

Creation takes exactly one of `--file` and `--parent`; repeat `--tag` for direct Tags. IDs retain their
spelling. Edit the generated Markdown to add content. `stem add <ref> to block <id>` inserts an inclusion
before the parent's closer. `stem delete block <id> [--force]` removes only the definition/subtree,
preserving the file. Force permits known dangling references but cannot bypass uncertain safety.
`stem rename <old-id> <new-id>` edits recognized tokens and matching local output selectors, preserving
filenames and unrelated text. Failures report confirmed changed files and the failing stage.

## Configuration

`stem init` creates the source directory, identity/configuration and a computation-cache ignore entry.
`stem init --force` preserves valid configuration and identity. To retain existing identity after losing
configuration, restore it from version control. There is no automatic View-file conversion.

```json
{
  "projectId": "0f671f2d-657d-4f3c-9a7d-d22f769c083a",
  "blocksDir": "blocks",
  "cacheDir": ".stem/cache",
  "outputSets": {
    "docs": {
      "outputDir": "published",
      "ifExists": "replace",
      "cleanup": "keep",
      "targets": [
        { "source": { "kind": "block", "ref": "welcome" }, "path": "README.md" },
        { "source": { "kind": "file", "path": "blocks/guide.md" }, "path": "guide.md" }
      ]
    }
  }
}
```

This UUID is illustrative; initialize each independent project to create its own identity.
See [configuration semantics](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md#configuration-validation)
for supported fields, strict validation and identity lifecycle.

## Export and cleanup

```sh
stem list outputs --json
stem render set docs
stem render set docs --target README.md
stem render all
stem cleanup --output-dir published --set docs
stem cleanup --output-dir published --set docs --apply
```

Repeat `--target` for several configured destinations. Explicit target selection is always a partial-set
run and cannot authorize automatic pruning. No destination override is accepted. Preview can emit partial
content; `render block/file --stdout` emits nothing unless eligible. Both keep stdout bytes exact and send
diagnostics to stderr. They exit nonzero for incomplete content or errors.

Preview/render accept `--max-work <integer>` and `--max-output-bytes <integer>`. Node operations accept
`options.limits`. See [shared limits](https://github.com/stemdev-hub/cli/blob/main/docs/specs/composition.md#d24-resource-budgets)
for defaults and measurement limits. Zero is valid; values are never silently clamped.

Publication reports published/skipped/not-published targets and tracking outcomes, plus cleanup and
stage-specific errors. Read the [ownership semantics](https://github.com/stemdev-hub/cli/blob/main/docs/reference.md#output-publication)
before enabling pruning. A failed run can still have confirmed published files.

## Checking and sync

`stem check [--json] [--strict-external] [--use-remote]` evaluates fresh sources and external metadata.
`stem sync` reparses all discovered sources and writes disposable file metadata and a position-free graph.
No read/preview operation needs sync first. Metadata-only `fetch-namespaces` and `publish-graph` retain
explicit HTTP workflows; they do not fetch authored connection sources.

## MCP server

Run `stem mcp` for stdio transport. Tools: `list_blocks`, `list_references`, `list_outputs`,
`check_references`, `preview_source`. All advertise read-only behavior and return matching JSON text and
structured operation envelopes. Partial preview is an evaluated success with `complete: false`;
operation failures set `isError`. `preview_source` accepts an explicit `source` selector and optional
`limits`. `stem://blocks/{id}` returns exactly one uniquely selected authored range.

For assistant configuration use `stem mcp setup`, or the editor's
[MCP setup command](https://github.com/stemdev-hub/cli/blob/main/packages/vscode-stem/README.md#ai-context-server-mcp).

## Node API

Import operations from `@stemdev/cli` and portable types from `@stemdev/core`. Reads return
`OperationResult<T>`; mutations and output publication retain confirmed outcomes on failure.
No legacy View APIs or compatibility aliases remain. Generated declarations own signatures.

## Contributing and license

[Contribution guide](https://github.com/stemdev-hub/cli/blob/main/CONTRIBUTING.md) ·
[MIT](https://github.com/stemdev-hub/cli/blob/main/LICENSE)
