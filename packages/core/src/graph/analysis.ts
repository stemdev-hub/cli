import type { Diagnostic, SourceLocation } from '../parser/syntax.js';
import type {
  AnalysisScope, Definition, GraphCycle, GraphEdge, InstanceContext, OutputScope, OutputUsage, StemGraph
} from '../project/model.js';
import { definitionLocation, freezeOwned, issue } from '../project/model.js';
import { lookupBlockReference } from '../project/selection.js';
import { createActivePath } from './traverser.js';

interface GraphIndex {
  outgoing: Map<Definition, GraphEdge[]>;
  ordinals: Map<Definition, number>;
}
const indexes = new WeakMap<StemGraph, GraphIndex>();
const cycleResults = new WeakMap<StemGraph, readonly GraphCycle[]>();
function graphIndex(graph: StemGraph): GraphIndex {
  const known = indexes.get(graph);
  if (known) return known;
  const outgoing = new Map<Definition, GraphEdge[]>();
  const ordinals = new Map(graph.nodes.map((node, index) => [node, index]));
  for (const edge of graph.edges) {
    const from = edge.kind === 'containment' ? edge.from : edge.occurrence.owner;
    if (from) {
      const edges = outgoing.get(from) ?? [];
      edges.push(edge);
      outgoing.set(from, edges);
    }
  }
  const result = { outgoing, ordinals };
  indexes.set(graph, result);
  return result;
}

function edgeTarget(edge: GraphEdge): Definition | undefined {
  return edge.kind === 'containment' ? edge.to
    : edge.occurrence.resolution.status === 'resolved' ? edge.occurrence.resolution.target : undefined;
}

function edgeLocation(edge: GraphEdge): SourceLocation {
  return edge.kind === 'containment' ? definitionLocation(edge.to)
    : { sourceId: edge.occurrence.source.tree.source.sourceId, range: edge.occurrence.syntax.range,
      instance: edge.occurrence.source.instance.handle };
}

export function buildGraph(scope: AnalysisScope): StemGraph {
  const nodes: Definition[] = [];
  const edges: GraphEdge[] = [];
  for (const instance of scope.instances) for (const source of instance.sources) {
    for (const definition of source.definitions) nodes.push(definition);
    const ordered: GraphEdge[] = [];
    for (const definition of source.definitions) {
      if (definition.parent) ordered.push({ kind: 'containment', from: definition.parent, to: definition });
    }
    for (const occurrence of source.inclusions) ordered.push({ kind: 'inclusion', occurrence });
    // Containment and inclusion occurrences retain their relative authored order.
    ordered.sort((left, right) => edgeLocation(left).range.startOffset - edgeLocation(right).range.startOffset);
    for (const edge of ordered) edges.push(Object.freeze(edge));
  }
  // Instance records are owned/frozen by analyzeProject, not by this derived view.
  return Object.freeze({ instances: scope.instances, nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
}

export function detectCycles(graph: StemGraph): readonly GraphCycle[] {
  const existing = cycleResults.get(graph);
  if (existing) return existing;
  const data = graphIndex(graph);
  const visited = new Set<Definition>();
  const active = createActivePath<Definition>();
  const cycles: GraphCycle[] = [];
  const seen = new Set<string>();
  const stack: { node: Definition; edges: readonly GraphEdge[]; next: number }[] = [];
  const enter = (node: Definition, edge?: GraphEdge): void => {
    if (visited.has(node)) return;
    const path = active.enter(node);
    if (path) {
      const sequence = path.slice(0, -1).map(item => data.ordinals.get(item)!);
      let first = 0;
      for (let i = 1; i < sequence.length; i++) if (sequence[i]! < sequence[first]!) first = i;
      const key = [...sequence.slice(first), ...sequence.slice(0, first)].join(',');
      if (!seen.has(key) && edge) {
        const diagnostic = freezeOwned(issue('BLOCK_CYCLE', 'Block containment and inclusions form a cycle.',
          edgeLocation(edge), path.slice(0, -1).map(definitionLocation)));
        cycles.push(Object.freeze({ path: Object.freeze(path), closingEdge: edge, diagnostic }));
        seen.add(key);
      }
      return;
    }
    stack.push({ node, edges: data.outgoing.get(node) ?? [], next: 0 });
  };
  for (const node of graph.nodes) {
    enter(node);
    while (stack.length > 0) {
      const frame = stack.at(-1)!;
      if (frame.next === frame.edges.length) {
        visited.add(frame.node);
        active.leave();
        stack.pop();
      } else {
        const edge = frame.edges[frame.next++]!;
        const target = edgeTarget(edge);
        if (target) enter(target, edge);
      }
    }
  }
  const result = Object.freeze(cycles);
  cycleResults.set(graph, result);
  return result;
}

export function validateGraph(graph: StemGraph): readonly Diagnostic[] {
  const diagnostics = new Set<Diagnostic>();
  for (const instance of graph.instances) {
    for (const diagnostic of instance.diagnostics) diagnostics.add(diagnostic);
    for (const source of instance.sources) for (const diagnostic of source.diagnostics) diagnostics.add(diagnostic);
  }
  for (const cycle of detectCycles(graph)) diagnostics.add(cycle.diagnostic);
  return freezeOwned([...diagnostics]);
}

export function getOrphanedBlocks(graph: StemGraph, localInstance: InstanceContext | undefined,
  outputs?: OutputScope): OutputUsage {
  if (!outputs || (outputs.complete && outputs.targets.length === 0)) {
    return freezeOwned({ applicable: false, complete: true, blocks: [], diagnostics: [] });
  }
  const diagnostics: Diagnostic[] = [];
  let complete = outputs.complete && localInstance !== undefined
    && graph.instances.includes(localInstance) && localInstance.available;
  const visited = new Set<Definition>();
  const pending: Definition[] = [];
  const follow = (edge: GraphEdge): void => {
    const target = edgeTarget(edge);
    if (target) pending.push(target);
    else {
      complete = false;
      diagnostics.push(issue('INCOMPLETE_OUTPUT_USAGE', 'An output reaches an unresolved inclusion.', edgeLocation(edge), undefined, 'warning'));
    }
  };
  const local = localInstance && graph.instances.includes(localInstance) ? localInstance : undefined;
  for (const target of outputs.targets) {
    if (target.kind === 'block') {
      const resolution = lookupBlockReference(graph, local, target.reference);
      if (resolution.status === 'resolved') pending.push(resolution.target);
      else {
        complete = false;
        // Assessment limitations are advisory, not extra content errors or export blockers.
        diagnostics.push(issue('INCOMPLETE_OUTPUT_USAGE', 'A configured Block output target is unavailable or ambiguous.',
          undefined, resolution.status === 'ambiguous' ? resolution.candidates.map(definitionLocation) : undefined, 'warning'));
      }
    } else {
      const matches = local?.sources.filter(source => source.tree.source.sourceId === target.sourceId) ?? [];
      if (matches.length !== 1) { complete = false; continue; }
      const source = matches[0]!;
      if (!source.referencesComplete) complete = false;
      for (const definition of source.definitions) pending.push(definition);
      for (const occurrence of source.inclusions) if (!occurrence.owner) follow({ kind: 'inclusion', occurrence });
    }
  }
  const data = graphIndex(graph);
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    if (!node.referencesComplete) complete = false;
    for (const edge of data.outgoing.get(node) ?? []) follow(edge);
  }
  if (!complete) {
    if (diagnostics.length === 0) diagnostics.push(issue('INCOMPLETE_OUTPUT_USAGE',
      'Output reachability cannot be assessed completely from the supplied roots and sources.', undefined, undefined, 'warning'));
    return freezeOwned({ applicable: true, complete: false, blocks: [], diagnostics });
  }
  const blocks = graph.nodes.filter(node => node.instance === local && !visited.has(node));
  for (const definition of blocks) diagnostics.push(issue('ORPHANED_BLOCK',
    'Block is not reachable from any configured output; it may have been left out.', definitionLocation(definition), undefined, 'warning'));
  return freezeOwned({ applicable: true, complete: true, blocks, diagnostics });
}
