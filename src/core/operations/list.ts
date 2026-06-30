import type {
  ListBlocksResult,
  ListViewsResult,
  OperationResult,
  ParsedBlock,
  ParsedView,
  ProjectOperationOptions,
  StemGraph
} from '@stem/types';
import { loadProjectGraph } from './project.js';

export async function listBlocks(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<ListBlocksResult>> {
  const projectResult = await loadProjectGraph(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const blocks = [...projectResult.data.blocks]
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
  options: ProjectOperationOptions = {}
): Promise<OperationResult<ListViewsResult>> {
  const projectResult = await loadProjectGraph(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const views = [...projectResult.data.views]
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
