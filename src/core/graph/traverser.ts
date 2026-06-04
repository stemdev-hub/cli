import type { DependencyRef, StemGraph } from '@stem/types';

export function getViewsUsingBlock(graph: StemGraph, blockId: string): string[] {
  return [...(graph.blockUsedInViews.get(blockId) ?? [])];
}

export function getBlockDependencies(graph: StemGraph, blockId: string): DependencyRef[] {
  return (graph.blockDependsOn.get(blockId) ?? []).map((dependency) => ({ ...dependency }));
}

export function getBlockDependents(graph: StemGraph, blockId: string): string[] {
  return [...(graph.blockDependents.get(blockId) ?? [])];
}

export function getOrphanedBlocks(graph: StemGraph): string[] {
  return [...graph.nodes.values()]
    .filter((node) => node.type === 'block')
    .filter((node) => (graph.blockUsedInViews.get(node.id) ?? []).length === 0)
    .map((node) => node.id);
}

export function detectCycles(graph: StemGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const seenCycles = new Set<string>();

  for (const node of graph.nodes.values()) {
    if (node.type === 'block' && !visited.has(node.id)) {
      detectCyclesFromNode(graph, node.id, visited, [], cycles, seenCycles);
    }
  }

  return cycles;
}

export function getDependencyChain(
  graph: StemGraph,
  blockId: string,
  direction: 'dependents' | 'dependencies'
): string[] {
  const result: string[] = [];
  const visited = new Set<string>([blockId]);

  collectDependencyChain(graph, blockId, direction, visited, result);

  return result;
}

function detectCyclesFromNode(
  graph: StemGraph,
  nodeId: string,
  visited: Set<string>,
  path: string[],
  cycles: string[][],
  seenCycles: Set<string>
): void {
  const pathIndex = path.indexOf(nodeId);
  if (pathIndex !== -1) {
    const cycle = [...path.slice(pathIndex), nodeId];
    const cycleKey = getCycleKey(cycle);

    if (!seenCycles.has(cycleKey)) {
      cycles.push(cycle);
      seenCycles.add(cycleKey);
    }
    return;
  }

  if (visited.has(nodeId)) {
    return;
  }

  path.push(nodeId);
  for (const dependent of getBlockDependents(graph, nodeId)) {
    detectCyclesFromNode(graph, dependent, visited, path, cycles, seenCycles);
  }
  path.pop();
  visited.add(nodeId);
}

function collectDependencyChain(
  graph: StemGraph,
  blockId: string,
  direction: 'dependents' | 'dependencies',
  visited: Set<string>,
  result: string[]
): void {
  const nextIds =
    direction === 'dependents'
      ? getBlockDependents(graph, blockId)
      : getBlockDependencies(graph, blockId).map((dependency) => dependency.blockId);

  for (const nextId of nextIds) {
    if (visited.has(nextId)) {
      continue;
    }

    visited.add(nextId);
    result.push(nextId);
    collectDependencyChain(graph, nextId, direction, visited, result);
  }
}

function getCycleKey(cycle: string[]): string {
  const withoutClosingNode = cycle.slice(0, -1);
  const rotations = withoutClosingNode.map((_, index) => [
    ...withoutClosingNode.slice(index),
    ...withoutClosingNode.slice(0, index)
  ]);
  const normalized = rotations.map((rotation) => rotation.join('\u0000')).sort()[0] ?? cycle.join('\u0000');

  return normalized;
}
