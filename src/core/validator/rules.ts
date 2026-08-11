import type { ParsedBlock, ParsedView, StemGraph, TagSchema, ValidationIssue } from '@stem/types';

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
}

export function validateGraph(input: ValidatorInput): ValidationIssue[] {
  const blockLookup = createBlockLookup(input.blocks);

  return [
    ...checkDuplicateIds(input.buildIssues),
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
      .filter((blockRef) => !graph.nodes.has(blockRef.blockId))
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
      if (blockRef.section === null) {
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
      if (blockRef.section === null || blockRef.tag === null) {
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
