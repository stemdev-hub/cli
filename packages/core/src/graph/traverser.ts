import type { DependencyRef, StemGraph } from '../types/index.js';

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

/**
 * Internal active-path tracking shared by core traversals. A rejected entry leaves
 * the path unchanged; leaving an entry allows it on a later independent path.
 * Callers supply stable keys for their identity scope. Pure Block callers must
 * distinguish resolved Block instances, rather than keying only by authored ID.
 * This helper is not exported through the public package entry.
 */
export function createActivePath<T>() {
  const entries: T[] = [];
  const positions = new Map<T, number>();

  return {
    enter(value: T): T[] | undefined {
      const position = positions.get(value);
      if (position !== undefined) {
        return [...entries.slice(position), value];
      }
      positions.set(value, entries.length);
      entries.push(value);
      return undefined;
    },
    leave(): void {
      if (entries.length === 0) {
        throw new Error('Cannot leave an empty active path.');
      }
      const value = entries[entries.length - 1] as T;
      entries.pop();
      positions.delete(value);
    }
  };
}

export function detectCycles(graph: StemGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const seenCycles = new Set<string>();
  const activePath = createActivePath<string>();
  const stack: Array<{ nodeId: string; dependents: Iterator<string> }> = [];

  function enter(nodeId: string): void {
    if (visited.has(nodeId)) return;

    const cycle = activePath.enter(nodeId);
    if (cycle !== undefined) {
      const cycleKey = getCycleKey(cycle);
      if (!seenCycles.has(cycleKey)) {
        cycles.push(cycle);
        seenCycles.add(cycleKey);
      }
      return;
    }

    stack.push({ nodeId, dependents: getBlockDependents(graph, nodeId).values() });
  }

  for (const node of graph.nodes.values()) {
    if (node.type === 'block' && !visited.has(node.id)) {
      enter(node.id);
      while (stack.length > 0) {
        const frame = stack[stack.length - 1]!;
        const next = frame.dependents.next();
        if (next.done) {
          visited.add(frame.nodeId);
          activePath.leave();
          stack.pop();
        } else {
          enter(next.value);
        }
      }
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
  // Active-path entries are unique, so the smallest ID determines one rotation.
  // Do not materialize every rotation of a potentially very long cycle.
  let start = 0;
  for (let index = 1; index < withoutClosingNode.length; index += 1) {
    if (withoutClosingNode[index]! < withoutClosingNode[start]!) start = index;
  }
  return JSON.stringify([
    ...withoutClosingNode.slice(start),
    ...withoutClosingNode.slice(0, start)
  ]);
}
