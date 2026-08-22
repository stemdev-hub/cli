# Stem Parser Spike

This paragraph stays ordinary Markdown and contains a plain reference: @stem[block:auth-flow-block]

A filtered reference appears here: @stem[block:auth-flow-block section=auth-flow tag=summary]

Additional block variants:

- Section only: @stem[block:auth-flow-block section=auth-flow]
- Tag only: @stem[block:auth-flow-block tag=summary]

@stem[section:auth-flow]

## Authentication Flow

@stem[tag:summary]
Authentication summary content remains Markdown text.
@stem[end]

@stem[tag:summary section=auth-flow]
External summary content remains Markdown text.
@stem[end]

Dependencies:

- @stem[dep:jwt-token-block]
- @stem[dep:jwt-token-block#jwt-token.api]

@stem[end]

The following fenced examples must not become Stem nodes:

```md
@stem[block:auth-flow-block]
@stem[block:auth-flow-block section=auth-flow tag=summary]
@stem[block:auth-flow-block section=auth-flow]
@stem[block:auth-flow-block tag=summary]
@stem[section:auth-flow]
@stem[tag:summary]
@stem[tag:summary section=auth-flow]
@stem[dep:jwt-token-block]
@stem[dep:jwt-token-block#jwt-token.api]
@stem[end]
```

These inline examples must also be ignored: `@stem[block:auth-flow-block] @stem[tag:summary] @stem[end]`.

- Regular list item one.
- Regular list item two with **bold Markdown**.
