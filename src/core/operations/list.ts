import type {
  ListBlocksResult,
  ListBlocksOptions,
  ListViewsResult,
  ListViewsOptions,
  OperationResult,
  ParsedBlock,
  ParsedView,
  StemGraph
} from '@stem/types';
import { loadProjectGraph } from './project.js';

export async function listBlocks(
  options: ListBlocksOptions = {}
): Promise<OperationResult<ListBlocksResult>> {
  const projectResult = await loadProjectGraph(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const blocks = [...projectResult.data.blocks]
    .filter((block) => options.tag === undefined || block.tags.includes(options.tag))
    .sort(compareByRelativePath)
    .map((block) => toListBlock(block, projectResult.data.graph));

  return {
    success: true,
    data: {
      blocks,
      total: blocks.length
    }
  };
}

export async function listViews(
  options: ListViewsOptions = {}
): Promise<OperationResult<ListViewsResult>> {
  const projectResult = await loadProjectGraph(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const views = [...projectResult.data.views]
    .filter((view) => {
      const blockId = options.blockId;
      return blockId === undefined || (projectResult.data.graph.viewUsesBlocks.get(view.id) ?? []).includes(blockId);
    })
    .sort(compareByRelativePath)
    .map((view) => toListView(view, projectResult.data.graph));

  return {
    success: true,
    data: {
      views,
      total: views.length
    }
  };
}

function toListBlock(block: ParsedBlock, graph: StemGraph): ListBlocksResult['blocks'][number] {
  return {
    id: block.id,
    tags: [...block.tags],
    relativePath: block.relativePath,
    usedInViews: [...(graph.blockUsedInViews.get(block.id) ?? [])],
    sectionCount: block.sections.length,
    standaloneTagCount: block.standaloneTags.length
  };
}

function toListView(view: ParsedView, graph: StemGraph): ListViewsResult['views'][number] {
  const blockIds = graph.viewUsesBlocks.get(view.id) ?? [];

  return {
    id: view.id,
    group: view.group,
    relativePath: view.relativePath,
    blockCount: blockIds.length,
    blockIds: [...blockIds]
  };
}

function compareByRelativePath(left: ParsedBlock | ParsedView, right: ParsedBlock | ParsedView): number {
  return left.relativePath.localeCompare(right.relativePath);
}
