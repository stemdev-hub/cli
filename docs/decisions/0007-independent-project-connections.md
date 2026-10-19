# 0007. Independent project connections

Status: proposed. Product acceptance and implementation remain deferred.

## Context

Reusable content may need multiple editions or update policies in one consumer.
Project identity alone cannot identify the source state and dependency context.

## Decision

Give each consumer-owned connection a stable ID and a unique local alias,
separate from source project identity. Support local folders and remote Git sources.
Allow multiple connections to the same project at equal or different revisions.
Keep their settings and selected dependency graphs independent; immutable content
may be shared without coupling updates. Shared mutable folders still share edits.
Preserve source reference context through inclusion and nested dependencies.
Retrieve remote content locally, record resolved revisions, and default to explicit
updates; automatic refresh is opt-in per connection.
Detailed contracts and D5 traceability live in the proposed
[project-connections specification](../specs/project-connections.md).

## Rejected

- One selected state per project ID: prevents parallel editions and update policies.
- Copying authored definitions for each connection: unnecessary new identities.
- Receiving-project alias overrides: change the meaning of included source.
- Fetching the latest source on every use: defeats repeatable evaluation.

## Consequences

Resolution must retain source state and dependency bindings, not just project IDs.
Storage sharing must preserve independent connection lifecycle and failures.
Block-cycle handling remains in the [composition spec](../specs/composition.md#d12-expansion-cycles).
Relevant precedents: [npm aliases](https://docs.npmjs.com/cli/v8/commands/npm-install/)
and [Nix named inputs and resolved graphs](https://nix.dev/manual/nix/2.26/command-ref/new-cli/nix3-flake.html#lock-files).
These inform the choice; Stem's own specification defines its contracts.
[Open mechanics](../../roadmap.md#pure-block-open-and-deferred-work) remain undecided.
This proposal does not yet replace existing snapshot APIs or accept ADR-0005.
