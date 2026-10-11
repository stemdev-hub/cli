# Status

Agent-editable. Budget: 60 lines. Delete items when resolved.

## Open spec bugs (resolve before further implementation)

- `resolveBlockSelection()` returns array for tag refs; substitution site expects string; no merge rule for duplicate tags under warning.
- `GraphEdge.to` typed as local node id; namespace refs target nodes never in local `nodes` map.
- "tags" used in three senses (frontmatter labels, `@stem[tag:name]` fragments, `StemSection.tags`). Proposed: rename frontmatter field to `labels`.
- These are historical claims, not newly verified defects. [R00](../roadmap.md#r00-establish-which-status-items-block-implementation) owns their disposition; the owner's deferral to the Pure Block Model migration and extension-remediation gate waiver are recorded in [R01](../roadmap.md#r01-use-core-semantics-when-opening-a-view-preview).

## Open policy

- Transclusion depth and cycle-warning: soft-warning threshold and configurability undecided.
- ADR-0002 acceptance and protected-instruction corrections require the [human decisions](../roadmap.md#human-decisions); no policy change is implied by the audit.

## Post-publication remediation

- Core extraction and first coordinated stable releases are complete. See the [8 October 2026 audit baseline](../roadmap.md#audit-baseline) for source/artifact identity, checks, and coverage limitations.
- Detailed tasks and their statuses live only in the [remediation backlog](../roadmap.md#repository-remediation). [R01-R03 and R08 implemented](../roadmap.md#execution-order). Release execution remains separately authorized through R10.
- Follow the [execution order](../roadmap.md#execution-order) subject to explicit owner dispositions recorded in the selected task; R00 remains open for its remaining decisions.
- Editor remediation: [R01](../roadmap.md#r01-use-core-semantics-when-opening-a-view-preview) and [R02](../roadmap.md#r02-serialize-mcp-configuration-separately-for-vs-code-and-cursor) retain separate host acceptance; [CLI discovery R03](../roadmap.md#r03-resolve-the-configured-or-installed-cli-without-relying-on-version) is done with a verified candidate; packaged contribution link [R08](../roadmap.md#r08-correct-the-packaged-extension-contribution-link) is done with a verified VSIX candidate. Published-consumer verification remains under R10.
- Dependency work: [ownership R04](../roadmap.md#r04-correct-cli-runtime-dependency-ownership) is done; [advisory investigation R05](../roadmap.md#r05-determine-the-smallest-justified-advisory-remediation) is done with reachability evidence and bounded follow-up scopes. Remediation and ADR-gated dependency removal remain unimplemented; published exposure remains open.
- Documentation work: [guidance R06](../roadmap.md#r06-align-existing-repository-guidance-with-the-released-architecture) is done, including the owner-authorized core README; packaged guidance awaits R10. [Generated API R07](../roadmap.md#r07-regenerate-the-cli-api-reference) is done; [published guide link R08](../roadmap.md#r08-correct-the-packaged-extension-contribution-link) is source-complete.
- Optional version support is [deferred R09](../roadmap.md#r09-add-package-derived-cli-version-reporting); it does not block extension discovery repair. Other suggestions are in the [deferred register](../roadmap.md#deferred-and-rejected-suggestions).
- Track source completion separately from [published-consumer verification R10](../roadmap.md#r10-verify-an-authorized-release-delivers-selected-fixes).

## Remaining namespace issues

- External graph format `.stem/cache/stem-graph.json` (ExternalStemGraph) differs from sync's `graph.json` (internal GraphSnapshot); this is not a filename bug. Only `publishGraph()` produces the external format and it does not save it locally, so local-only namespace use has no producer. Decide via ADR before building a shared namespace loader.
- External snapshot types exported from core remain provisional until the namespace/snapshot ADR.
- Snapshot envelope `fetchedAt` is not validated as a date; [ADR-0004](decisions/0004-core-schema-and-snapshot-decoders.md) preserves this behavior. Revisit with the namespace ADR.
- CLI/extension namespace loading policy remains duplicated pending that decision; see [deferred D07](../roadmap.md#deferred-and-rejected-suggestions).

## Remaining validation and release constraints

- Real extension-host behavior remains unverified; previously passing Windows file-link/junction/broken-link parity does not verify cyclic links or native POSIX directory symlinks. See [audit limits](../roadmap.md#audit-baseline) and task-specific acceptance checks.
- Prior status reported 24 deprecation warnings for `@yuku-parser/binding-win32-x64` through core's tsdown development dependency; not reverified by backlog creation and not a demonstrated development blocker.
- Preserve the configured `release-please.yml` workflow identity and review trusted-publisher settings before any future repository/workflow rename. Release execution is separately authorized through R10; core-first ordering remains governed by [ADR-0001](decisions/0001-extract-core-package.md).
- Re-run `npm audit --omit=dev` on the packed consumer install before each release.
