import { parse } from '../parser/scanner.js';
import type { Diagnostic, SourceLocation, SyntaxNode } from '../parser/syntax.js';
import { buildGraph, detectCycles, getOrphanedBlocks, validateGraph } from '../graph/analysis.js';
import type {
  AnalyzedSource, Definition, InclusionOccurrence, InstanceContext, ProjectAnalysis, ProjectSnapshot
} from './model.js';
import { definitionLocation, freezeOwned, issue } from './model.js';
import { duplicateDefinitions, lookupBlockReference } from './selection.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer Item)[] ? Item[] : T[K] };
type PendingInclusion = { source: Mutable<AnalyzedSource>; owner?: Mutable<Definition>;
  syntax: InclusionOccurrence['syntax'] };

/** Fresh pure interpretation of supplied sources; no connection resolution, cache or I/O. */
export function analyzeProject(snapshot: ProjectSnapshot): ProjectAnalysis {
  const instances: Mutable<InstanceContext>[] = snapshot.instances.map(input => ({
    handle: Object.freeze({}), available: input.sources !== undefined && input.sourcesComplete !== false,
    sources: [], bindings: [], diagnostics: []
  }));
  const supplied = new Map<object, Mutable<InstanceContext>[]>();
  snapshot.instances.forEach((input, at) => {
    const matches = supplied.get(input.handle) ?? [];
    matches.push(instances[at]!);
    supplied.set(input.handle, matches);
  });
  const diagnostics = new Set<Diagnostic>();
  for (const matches of supplied.values()) {
    if (matches.length < 2) continue;
    for (const instance of matches) {
      instance.available = false;
      instance.diagnostics.push(issue('INVALID_INSTANCE_CONTEXT', 'Supplied instance handle is repeated.'));
    }
  }
  const localMatches = supplied.get(snapshot.localInstance);
  const localInstance = localMatches?.length === 1 ? localMatches[0] : undefined;
  if (!localInstance) diagnostics.add(issue('UNAVAILABLE_LOCAL_INSTANCE', 'Local instance is missing or ambiguous.'));

  const pending: PendingInclusion[] = [];
  // Equal source inputs may share syntax; never share their semantic definition records.
  const parsed = new Map<string, Map<string, ReturnType<typeof parse>>>();
  const instanceDiagnostic = (diagnostic: Diagnostic, instance: InstanceContext): Diagnostic => {
    const contextualize = (location: SourceLocation): SourceLocation => ({ ...location, instance: instance.handle });
    return { ...diagnostic,
      ...(diagnostic.location ? { location: contextualize(diagnostic.location) } : {}),
      ...(diagnostic.related ? { related: diagnostic.related.map(contextualize) } : {}) };
  };

  snapshot.instances.forEach((input, at) => {
    const instance = instances[at]!;
    if (input.sources === undefined || input.sourcesComplete === false) {
      instance.diagnostics.push(issue('UNAVAILABLE_SOURCE', 'Supplied source inventory is unavailable or incomplete.'));
    }
    const sourceIds = new Set<string>();
    for (const document of input.sources ?? []) {
      if (sourceIds.has(document.sourceId)) {
        instance.available = false;
        instance.diagnostics.push(issue('DUPLICATE_SOURCE_ID', `Source handle is repeated: ${document.sourceId}.`));
      }
      sourceIds.add(document.sourceId);
      const versions = parsed.get(document.sourceId) ?? new Map<string, ReturnType<typeof parse>>();
      let syntax = versions.get(document.content);
      if (!syntax) {
        syntax = parse(document);
        versions.set(document.content, syntax);
        parsed.set(document.sourceId, versions);
      }
      const associated = new Map(syntax.diagnostics.map(diagnostic => [diagnostic, instanceDiagnostic(diagnostic, instance)]));
      const source: Mutable<AnalyzedSource> = { instance, tree: syntax.tree, definitions: [], inclusions: [],
        diagnostics: [...associated.values()], referencesComplete: true };
      instance.sources.push(source);
      const work: { nodes: readonly SyntaxNode[]; next: number; parent?: Mutable<Definition> }[] = [
        { nodes: syntax.tree.children, next: 0 }
      ];
      while (work.length > 0) {
        const frame = work.at(-1)!;
        if (frame.next >= frame.nodes.length) { work.pop(); continue; }
        const node = frame.nodes[frame.next++]!;
        if (node.kind === 'block') {
          const ids = node.header.fields.filter(field => field.name === 'id');
          const id = ids.length === 1 && ids[0]!.valid ? ids[0]!.id : undefined;
          const fields = node.header.fields.filter(field => field.name === 'tags');
          const tags = new Map<string, string>();
          if (fields.length === 1) for (const tag of fields[0]!.tags ?? []) {
            const key = tag.value.normalize('NFC');
            if (!tags.has(key)) tags.set(key, tag.value);
          }
          const definition: Mutable<Definition> = {
            instance, source, syntax: node, children: [], tags: [...tags.values()],
            classificationComplete: node.header.terminated && (fields.length === 0 || (fields.length === 1 && fields[0]!.valid)),
            referencesComplete: node.header.terminated,
            diagnostics: node.diagnostics.map(diagnostic => associated.get(diagnostic)!),
            ...(frame.parent ? { parent: frame.parent } : {}), ...(id === undefined ? {} : { id })
          };
          source.definitions.push(definition);
          frame.parent?.children.push(definition);
          work.push({ nodes: node.children, next: 0, parent: definition });
        } else if (node.kind === 'include') {
          pending.push({ source, syntax: node, ...(frame.parent ? { owner: frame.parent } : {}) });
        } else if (node.kind === 'error') {
          frame.parent?.diagnostics.push(...node.diagnostics.map(diagnostic => associated.get(diagnostic)!));
          if (node.diagnostics.some(diagnostic => diagnostic.code === 'INVALID_STEM_INSTRUCTION')) {
            if (frame.parent) frame.parent.referencesComplete = false;
            else source.referencesComplete = false;
          }
        }
      }
    }
    const bindings = input.bindings ?? [];
    const aliasCounts = new Map<string, number>();
    for (const binding of bindings) aliasCounts.set(binding.alias, (aliasCounts.get(binding.alias) ?? 0) + 1);
    for (const binding of bindings) {
      const errors: Diagnostic[] = [];
      let target: InstanceContext | undefined;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(binding.alias) || aliasCounts.get(binding.alias)! > 1) {
        errors.push(issue('INVALID_ALIAS_BINDING', `Invalid or repeated alias: ${binding.alias}.`));
      } else if ('unavailable' in binding) {
        errors.push(issue(binding.unavailable === 'invalid-configuration' ? 'INVALID_CONNECTION_CONFIGURATION' : 'UNAVAILABLE_SOURCE',
          `Alias target is unavailable: ${binding.alias}.`));
      } else {
        const targets = supplied.get(binding.target);
        if (targets?.length === 1) target = targets[0];
        else errors.push(issue('UNAVAILABLE_INSTANCE', `Alias target is missing or ambiguous: ${binding.alias}.`));
      }
      instance.bindings.push({ alias: binding.alias, diagnostics: errors, ...(target ? { target } : {}) });
      instance.diagnostics.push(...errors);
    }
  });

  const scope = { instances };
  for (const group of duplicateDefinitions(scope)) {
    const diagnostic = issue('DUPLICATE_BLOCK_ID', `Block ID has multiple definitions: ${group[0]!.id!}.`,
      definitionLocation(group[0]!), group.slice(1).map(definitionLocation));
    // One project diagnostic, associated with every candidate without quadratic related lists.
    const affectedSources = new Set<AnalyzedSource>();
    for (const definition of group) {
      (definition as Mutable<Definition>).diagnostics.push(diagnostic);
      affectedSources.add(definition.source);
    }
    for (const source of affectedSources) (source as Mutable<AnalyzedSource>).diagnostics.push(diagnostic);
  }
  for (const occurrence of pending) {
    const location: SourceLocation = { sourceId: occurrence.source.tree.source.sourceId,
      range: occurrence.syntax.range, instance: occurrence.source.instance.handle };
    const resolution = lookupBlockReference(scope, occurrence.source.instance, occurrence.syntax.target, location);
    occurrence.source.inclusions.push({ ...occurrence, resolution });
    occurrence.source.diagnostics.push(...resolution.diagnostics);
    occurrence.owner?.diagnostics.push(...resolution.diagnostics);
  }
  const graph = buildGraph(scope);
  for (const cycle of detectCycles(graph)) {
    const edge = cycle.closingEdge;
    const owner = edge.kind === 'containment' ? edge.from : edge.occurrence.owner;
    if (owner) {
      (owner as Mutable<Definition>).diagnostics.push(cycle.diagnostic);
      (owner.source as Mutable<AnalyzedSource>).diagnostics.push(cycle.diagnostic);
    }
  }
  const checked = validateGraph(graph);
  for (const diagnostic of checked) diagnostics.add(diagnostic);
  const outputUsage = getOrphanedBlocks(graph, localInstance, snapshot.outputs);
  for (const diagnostic of outputUsage.diagnostics) diagnostics.add(diagnostic);
  return freezeOwned({ instances, ...(localInstance ? { localInstance } : {}), graph,
    diagnostics: [...diagnostics], outputUsage });
}
