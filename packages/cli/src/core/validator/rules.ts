import type { ExternalSnapshotState, NamespaceConfig, ParsedBlock, ParsedView, StemGraph, TagSchema, ValidationIssue } from '@stem/types';

interface ValidatorBuildIssue {
  code: 'DUPLICATE_BLOCK_ID' | 'DUPLICATE_VIEW_ID';
  id: string;
  conflictingPaths: string[];
}

export interface ValidatorInput {
  graph: StemGraph;
  blocks: ParsedBlock[];
  views: ParsedView[];
  buildIssues: ValidatorBuildIssue[];
  schemas: Map<string, TagSchema>;
  cycles: string[][];
  orphanedBlocks: string[];
  configuredNamespaces: Record<string, NamespaceConfig>;
  externalGraphs: Map<string, ExternalSnapshotState>;
  strictExternal?: boolean;
}

export function validateGraph(input: ValidatorInput): ValidationIssue[] {
  const blockLookup = createBlockLookup(input.blocks);

  return [
    ...checkDuplicateIds(input.buildIssues),
    ...checkExternalRefs(input.views, input.configuredNamespaces, input.externalGraphs, input.strictExternal),
    ...checkBrokenBlockRefs(input.views, input.graph),
    ...checkInvalidBlockRefFilters(input.views),
    ...checkBrokenSectionRefs(input.views, blockLookup),
    ...checkUnresolvedTags(input.views, blockLookup),
    ...checkCircularDependencies(input.cycles, input.graph),
    ...checkOrphanedBlocks(input.orphanedBlocks, input.graph),
    ...checkDuplicateTagsInSections(input.blocks)
  ];
}

function checkDuplicateIds(buildIssues: ValidatorBuildIssue[]): ValidationIssue[] {
  return buildIssues.flatMap((issue) => {
    const [firstPath, ...collidingPaths] = issue.conflictingPaths;

    if (firstPath === undefined) {
      return [];
    }

    return collidingPaths.map(
      (collidingFilePath): ValidationIssue => ({
        code: 'DUPLICATE_ID',
        severity: 'error',
        message: `Duplicate ID "${issue.id}" found in ${collidingFilePath}.`,
        filePath: firstPath,
        relativePath: '',
        context: {
          id: issue.id,
          collidingFilePath
        }
      })
    );
  });
}

function checkInvalidBlockRefFilters(views: ParsedView[]): ValidationIssue[] {
  return views.flatMap((view) =>
    view.blockRefs
      .filter((blockRef) => blockRef.section === null && blockRef.tag !== null)
      .map(
        (blockRef): ValidationIssue => ({
          code: 'INVALID_BLOCK_REF_FILTER',
          severity: 'error',
          message: `Block reference "${blockRef.raw}" uses a tag filter without a section filter.`,
          filePath: view.filePath,
          relativePath: view.relativePath,
          position: shiftBodyPosition(blockRef.position, view),
          context: {
            targetId: blockRef.blockId,
            rawRef: blockRef.raw
          }
        })
      )
  );
}

function checkBrokenBlockRefs(views: ParsedView[], graph: StemGraph): ValidationIssue[] {
  return views.flatMap((view) =>
    view.blockRefs
      .filter((blockRef) => blockRef.namespace === null && !graph.nodes.has(blockRef.blockId))
      .map(
        (blockRef): ValidationIssue => ({
          code: 'BROKEN_BLOCK_REF',
          severity: 'error',
          message: `View references missing block "${blockRef.blockId}".`,
          filePath: view.filePath,
          relativePath: view.relativePath,
          position: shiftBodyPosition(blockRef.position, view),
          context: {
            targetId: blockRef.blockId,
            rawRef: blockRef.raw
          }
        })
      )
  );
}

function checkBrokenSectionRefs(views: ParsedView[], blockLookup: Map<string, ParsedBlock>): ValidationIssue[] {
  return views.flatMap((view) =>
    view.blockRefs.flatMap((blockRef) => {
      if (blockRef.namespace !== null || blockRef.section === null) {
        return [];
      }

      const block = blockLookup.get(blockRef.blockId);
      if (block === undefined || hasSection(block, blockRef.section)) {
        return [];
      }

      return [
        {
          code: 'BROKEN_SECTION_REF',
          severity: 'error',
          message: `View references missing section "${blockRef.section}" in block "${blockRef.blockId}".`,
          filePath: view.filePath,
          relativePath: view.relativePath,
          position: shiftBodyPosition(blockRef.position, view),
          context: {
            targetId: blockRef.blockId,
            targetSection: blockRef.section
          }
        } satisfies ValidationIssue
      ];
    })
  );
}

function checkUnresolvedTags(views: ParsedView[], blockLookup: Map<string, ParsedBlock>): ValidationIssue[] {
  return views.flatMap((view) =>
    view.blockRefs.flatMap((blockRef) => {
      if (blockRef.namespace !== null || blockRef.section === null || blockRef.tag === null) {
        return [];
      }

      const block = blockLookup.get(blockRef.blockId);
      const section = block?.sections.find((candidate) => candidate.name === blockRef.section);
      if (block === undefined || section === undefined || hasTagInSection(section, blockRef.tag)) {
        return [];
      }

      return [
        {
          code: 'UNRESOLVED_TAG',
          severity: 'error',
          message: `View references missing tag "${blockRef.tag}" in section "${blockRef.section}" of block "${blockRef.blockId}".`,
          filePath: view.filePath,
          relativePath: view.relativePath,
          position: shiftBodyPosition(blockRef.position, view),
          context: {
            targetId: blockRef.blockId,
            targetSection: blockRef.section,
            missingTag: blockRef.tag
          }
        } satisfies ValidationIssue
      ];
    })
  );
}

function checkExternalRefs(
  views: ParsedView[],
  configuredNamespaces: Record<string, NamespaceConfig>,
  externalGraphs: Map<string, ExternalSnapshotState>,
  strictExternal: boolean = false
): ValidationIssue[] {
  return views.flatMap((view) =>
    view.blockRefs.flatMap((blockRef): ValidationIssue[] => {
      if (blockRef.namespace === null) {
        return [];
      }

      if (!(blockRef.namespace in configuredNamespaces)) {
        return [
          {
            code: 'UNRESOLVED_NAMESPACE',
            severity: strictExternal ? 'error' : 'warning',
            message: `Namespace "${blockRef.namespace}" is not declared in configuration.`,
            filePath: view.filePath,
            relativePath: view.relativePath,
            position: shiftBodyPosition(blockRef.position, view),
            context: {
              namespace: blockRef.namespace,
              rawRef: blockRef.raw
            }
          }
        ];
      }

      const snapshot = externalGraphs.get(blockRef.namespace);
      if (snapshot === undefined) {
        return [
          {
            code: 'MISSING_SNAPSHOT',
            severity: strictExternal ? 'error' : 'warning',
            message: `No snapshot available for namespace "${blockRef.namespace}".`,
            filePath: view.filePath,
            relativePath: view.relativePath,
            position: shiftBodyPosition(blockRef.position, view),
            context: {
              namespace: blockRef.namespace,
              rawRef: blockRef.raw
            }
          }
        ];
      }

      if (!snapshot.isLocalFallback) {
        const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime();
        if (ageMs > 7 * 24 * 60 * 60 * 1000) {
          return [
            {
              code: 'EXPIRED_SNAPSHOT',
              severity: strictExternal ? 'error' : 'warning',
              message: `Snapshot for namespace "${blockRef.namespace}" has expired (fetched ${snapshot.fetchedAt}, TTL 7 days).`,
              filePath: view.filePath,
              relativePath: view.relativePath,
              position: shiftBodyPosition(blockRef.position, view),
              context: {
                namespace: blockRef.namespace,
                rawRef: blockRef.raw,
                fetchedAt: snapshot.fetchedAt
              }
            }
          ];
        }
      }

      const block = snapshot.graph.blocks.find((b) => b.id === blockRef.blockId);
      if (block === undefined) {
        const renameHint = snapshot.graph.renames.find((r) => r.from === blockRef.blockId);
        
        // TODO: BROKEN_BLOCK_REF context doesn't carry rename metadata structurally.
        // If stem fix or editor tooling needs the rename target, add renameTarget and renamedSince
        // to the BROKEN_BLOCK_REF context type.
        const message = renameHint
          ? `View references missing external block "${blockRef.blockId}". It was renamed to "${renameHint.to}" (since ${renameHint.since}).`
          : `View references missing external block "${blockRef.blockId}" in namespace "${blockRef.namespace}".`;

        return [
          {
            code: 'BROKEN_BLOCK_REF',
            severity: 'error',
            message,
            filePath: view.filePath,
            relativePath: view.relativePath,
            position: shiftBodyPosition(blockRef.position, view),
            context: {
              targetId: blockRef.blockId,
              rawRef: blockRef.raw
            }
          } satisfies ValidationIssue
        ];
      }

      if (blockRef.section !== null) {
        const section = block.sections.find((s) => s.id === blockRef.section);
        if (section === undefined) {
          return [
            {
              code: 'BROKEN_SECTION_REF',
              severity: 'error',
              message: `View references missing section "${blockRef.section}" in external block "${blockRef.blockId}".`,
              filePath: view.filePath,
              relativePath: view.relativePath,
              position: shiftBodyPosition(blockRef.position, view),
              context: {
                targetId: blockRef.blockId,
                targetSection: blockRef.section
              }
            } satisfies ValidationIssue
          ];
        }

        if (blockRef.tag !== null) {
          if (!section.tags.includes(blockRef.tag)) {
            return [
              {
                code: 'UNRESOLVED_TAG',
                severity: 'error',
                message: `View references missing tag "${blockRef.tag}" in section "${blockRef.section}" of external block "${blockRef.blockId}".`,
                filePath: view.filePath,
                relativePath: view.relativePath,
                position: shiftBodyPosition(blockRef.position, view),
                context: {
                  targetId: blockRef.blockId,
                  targetSection: blockRef.section,
                  missingTag: blockRef.tag
                }
              } satisfies ValidationIssue
            ];
          }
        }
      }

      return [];
    })
  );
}

function checkCircularDependencies(cycles: string[][], graph: StemGraph): ValidationIssue[] {
  return cycles.flatMap((cycle) => {
    const firstBlockId = cycle[0];
    if (firstBlockId === undefined) {
      return [];
    }

    const node = graph.nodes.get(firstBlockId);

    return [
      {
        code: 'CIRCULAR_DEPENDENCY',
        severity: 'warning',
        message: `Circular dependency detected: ${formatDependencyChain(cycle)}.`,
        filePath: node?.filePath ?? '',
        relativePath: node?.relativePath ?? '',
        context: {
          dependencyChain: formatDependencyChain(cycle)
        }
      } satisfies ValidationIssue
    ];
  });
}

function checkOrphanedBlocks(orphanedBlocks: string[], graph: StemGraph): ValidationIssue[] {
  return orphanedBlocks.map((blockId): ValidationIssue => {
    const node = graph.nodes.get(blockId);

    return {
      code: 'ORPHANED_BLOCK',
      severity: 'warning',
      message: `Block "${blockId}" is not referenced by any view.`,
      filePath: node?.filePath ?? '',
      relativePath: node?.relativePath ?? '',
      context: {
        blockId
      }
    };
  });
}

function checkDuplicateTagsInSections(blocks: ParsedBlock[]): ValidationIssue[] {
  return blocks.flatMap((block) =>
    block.sections.flatMap((section) => {
      const tagCounts = new Map<string, number>();

      for (const tag of [...section.tags, ...section.externalTags]) {
        tagCounts.set(tag.name, (tagCounts.get(tag.name) ?? 0) + 1);
      }

      return [...tagCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(
          ([tagName]): ValidationIssue => ({
            code: 'DUPLICATE_TAG_IN_SECTION',
            severity: 'warning',
            message: `Tag "${tagName}" appears more than once in section "${section.name}".`,
            filePath: block.filePath,
            relativePath: block.relativePath,
            context: {
              tagName,
              sectionName: section.name
            }
          })
        );
    })
  );
}

function createBlockLookup(blocks: ParsedBlock[]): Map<string, ParsedBlock> {
  return new Map(blocks.map((block) => [block.id, block]));
}

function hasSection(block: ParsedBlock, sectionName: string): boolean {
  return block.sections.some((section) => section.name === sectionName);
}

function hasTagInSection(section: ParsedBlock['sections'][number], tagName: string): boolean {
  return [...section.tags, ...section.externalTags].some((tag) => tag.name === tagName);
}

function shiftBodyPosition(position: ParsedView['blockRefs'][number]['position'], view: ParsedView): typeof position {
  const lineOffset = view.bodyStartLine - 1;
  if (lineOffset === 0) {
    return position;
  }

  return {
    ...position,
    start: { ...position.start, line: position.start.line + lineOffset },
    end: { ...position.end, line: position.end.line + lineOffset }
  };
}

function formatDependencyChain(cycle: string[]): string {
  return cycle.join(' -> ');
}
