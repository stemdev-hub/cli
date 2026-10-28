# 0011. Public Pure Block integration

Status: accepted (27 October 2026). The owner approved the coordinated integration plan,
explicit public retirement map, bounded file inventory and shared limits in chat against
`2aa87e6`. Implementation and verification are tracked in the roadmap.

## Decision

Replace the public engine and its CLI, MCP and editor callers together under ADR-0005.
Expose `parse`, `compose`, `resolveBlockReference` and `findBlocksByTag`; retain
`analyzeProject`, `buildGraph`, `validateGraph`, `detectCycles` and `getOrphanedBlocks`
with their accepted replacement contracts. Retain `SourceDocument`, `ProjectSnapshot`,
`ProjectAnalysis`, `StemGraph` and `GraphEdge` with readonly replacement representations.

Remove `parseBlockFile`, `parseViewFile` and `renderViewMarkdown`. Replace `ParsedBlock`
and `GraphNode` with `Definition`, `Position` with `SourceRange`/`SourceLocation`, and
`ValidationIssue`/`GraphBuildIssue` with `Diagnostic`. Remove `ParsedView`,
`DependencyRef`, `BlockParameter`, `BlockRefSyntax`, `ValidationResult` and
`AnalysisOptions`; adapters derive diagnostic summaries and external assessment takes
explicit time/strictness inputs. Supply no aliases, View bridges or legacy reconstruction.

Integrate readonly output configuration, exact source composition, safe token edits,
fresh position-free sync, publication and selective cleanup through the existing package
boundaries. Preserve authored View files. The specifications own detailed behavior.

Retain ADR-0004's public pure decoder and shape predicate, cached envelope, permissive
timestamp strings and adapter-owned I/O/fallback policy. Replace external metadata with
the Block-only projection accepted by ADR-0005. Metadata assessment never resolves source
content or suppresses its unavailability. Existing metadata exchange does not implement
ADR-0007 connection storage, Git transport or lifecycle mechanics.

## Consequences and alternatives

This supplies ADR-0001/0008 coverage for the concrete public removals and replacements;
it does not amend accepted decision bodies or introduce a package/domain primitive.
Source types/TSDoc own concrete declarations and persistence encodings. Composition's
specification owns the approved shared caller limits and override behavior.

A parser-only switch would break authoring, sync and consumers. Another private stage
has no demonstrated prerequisite. Compatibility adapters would preserve retired concepts.
Implement and verify the coordinated boundary before reporting it ready to commit;
host acceptance, distribution and deferred connections remain separate.
