import type {
  DependencyRef,
  GraphEdge,
  GraphNode,
  ParsedBlock,
  ParsedView
} from '@stem/types';
import type { GraphBuildIssue, GraphBuildResult } from './types.js';

export function buildGraph(blocks: ParsedBlock[], views: ParsedView[]): GraphBuildResult {
  const nodes = new Map<string, GraphNode>();
  const issues: GraphBuildIssue[] = [];

  addBlockNodes(nodes, issues, blocks);
  addViewNodes(nodes, issues, views);

  const edges = [...buildViewEdges(views), ...buildDependencyEdges(blocks)];

  return {
    graph: {
      nodes,
      edges,
      blockUsedInViews: buildBlockUsedInViews(edges),
      viewUsesBlocks: buildViewUsesBlocks(edges),
      blockDependsOn: buildBlockDependsOn(blocks),
      blockDependents: buildBlockDependents(edges)
    },
    issues
  };
}

function addBlockNodes(nodes: Map<string, GraphNode>, issues: GraphBuildIssue[], blocks: ParsedBlock[]): void {
  const seenBlockPaths = new Map<string, string>();

  for (const block of blocks) {
    const firstPath = seenBlockPaths.get(block.id);
    if (firstPath !== undefined) {
      issues.push({
        code: 'DUPLICATE_BLOCK_ID',
        id: block.id,
        conflictingPaths: [firstPath, block.filePath]
      });
      continue;
    }

    seenBlockPaths.set(block.id, block.filePath);
    nodes.set(block.id, {
      id: block.id,
      type: 'block',
      filePath: block.filePath,
      relativePath: block.relativePath,
      tags: [...block.tags],
      group: null
    });
  }
}

function addViewNodes(nodes: Map<string, GraphNode>, issues: GraphBuildIssue[], views: ParsedView[]): void {
  const seenViewPaths = new Map<string, string>();

  for (const view of views) {
    const firstPath = seenViewPaths.get(view.id);
    if (firstPath !== undefined) {
      issues.push({
        code: 'DUPLICATE_VIEW_ID',
        id: view.id,
        conflictingPaths: [firstPath, view.filePath]
      });
      continue;
    }

    seenViewPaths.set(view.id, view.filePath);
    nodes.set(view.id, {
      id: view.id,
      type: 'view',
      filePath: view.filePath,
      relativePath: view.relativePath,
      tags: [],
      group: view.group
    });
  }
}

function buildViewEdges(views: ParsedView[]): GraphEdge[] {
  return views.flatMap((view) =>
    view.blockRefs.map((blockRef) => ({
      type: 'view-uses-block',
      from: view.id,
      to: blockRef.blockId,
      section: blockRef.section,
      tag: blockRef.tag
    }))
  );
}

function buildDependencyEdges(blocks: ParsedBlock[]): GraphEdge[] {
  return blocks.flatMap((block) =>
    block.dependsOn.map((dependency) => ({
      type: 'block-depends-on',
      from: block.id,
      to: dependency.blockId,
      section: dependency.section,
      tag: dependency.tag
    }))
  );
}

function buildBlockUsedInViews(edges: GraphEdge[]): Map<string, string[]> {
  const lookup = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.type === 'view-uses-block') {
      addLookupValue(lookup, edge.to, edge.from);
    }
  }

  return toArrayMap(lookup);
}

function buildViewUsesBlocks(edges: GraphEdge[]): Map<string, string[]> {
  const lookup = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.type === 'view-uses-block') {
      addLookupValue(lookup, edge.from, edge.to);
    }
  }

  return toArrayMap(lookup);
}

function buildBlockDependsOn(blocks: ParsedBlock[]): Map<string, DependencyRef[]> {
  const lookup = new Map<string, DependencyRef[]>();
  const dedupeKeys = new Map<string, Set<string>>();

  for (const block of blocks) {
    for (const dependency of block.dependsOn) {
      const dedupeKey = `${dependency.blockId}\u0000${dependency.section ?? ''}\u0000${dependency.tag ?? ''}`;
      const existingKeys = dedupeKeys.get(block.id) ?? new Set<string>();

      if (!existingKeys.has(dedupeKey)) {
        lookup.set(block.id, [...(lookup.get(block.id) ?? []), { ...dependency }]);
        existingKeys.add(dedupeKey);
        dedupeKeys.set(block.id, existingKeys);
      }
    }
  }

  return lookup;
}

function buildBlockDependents(edges: GraphEdge[]): Map<string, string[]> {
  const lookup = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.type === 'block-depends-on') {
      addLookupValue(lookup, edge.to, edge.from);
    }
  }

  return toArrayMap(lookup);
}

function addLookupValue(lookup: Map<string, Set<string>>, key: string, value: string): void {
  const values = lookup.get(key) ?? new Set<string>();
  values.add(value);
  lookup.set(key, values);
}

function toArrayMap(lookup: Map<string, Set<string>>): Map<string, string[]> {
  return new Map([...lookup.entries()].map(([key, values]) => [key, [...values]]));
}
