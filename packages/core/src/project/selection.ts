import type { Diagnostic, SourceLocation } from '../parser/syntax.js';
import type { AnalysisScope, BlockReference, BlockResolution, Definition, InstanceContext } from './model.js';
import { definitionLocation, freezeOwned, issue, subtreeDiagnostics } from './model.js';

interface InstanceIndex {
  ids: Map<string, Definition[]>;
  tags: Map<string, Definition[]>;
  incomplete: Definition[];
  aliases: Map<string, InstanceContext['bindings'][number][]>;
}

// No mutable lookup maps escape through analysis results or the package entry.
const indexes = new WeakMap<AnalysisScope['instances'], Map<InstanceContext, InstanceIndex>>();
function index(scope: AnalysisScope): Map<InstanceContext, InstanceIndex> {
  const existing = indexes.get(scope.instances);
  if (existing) return existing;
  const result = new Map<InstanceContext, InstanceIndex>();
  for (const instance of scope.instances) {
    const data: InstanceIndex = { ids: new Map(), tags: new Map(), incomplete: [], aliases: new Map() };
    for (const source of instance.sources) {
      for (const definition of source.definitions) {
        if (definition.id !== undefined) {
          const matches = data.ids.get(definition.id) ?? [];
          matches.push(definition);
          data.ids.set(definition.id, matches);
        }
        for (const tag of definition.tags) {
          const key = tag.normalize('NFC');
          const matches = data.tags.get(key) ?? [];
          matches.push(definition);
          data.tags.set(key, matches);
        }
        if (!definition.classificationComplete) data.incomplete.push(definition);
      }
    }
    for (const binding of instance.bindings) {
      const bindings = data.aliases.get(binding.alias) ?? [];
      bindings.push(binding);
      data.aliases.set(binding.alias, bindings);
    }
    result.set(instance, data);
  }
  indexes.set(scope.instances, result);
  return result;
}

/** Internal inventory query used after every instance's definitions have been collected. */
export function duplicateDefinitions(scope: AnalysisScope): readonly (readonly Definition[])[] {
  return [...index(scope).values()].flatMap(data => [...data.ids.values()]
    .filter(definitions => definitions.length > 1).map(definitions => [...definitions]));
}

/** Internal resolution without subtree aggregation, used once per authored occurrence. */
export function lookupBlockReference(scope: AnalysisScope, from: InstanceContext | undefined,
  reference: BlockReference, location?: SourceLocation): BlockResolution {
  const all = index(scope);
  const data = from === undefined ? undefined : all.get(from);
  const failure = (status: 'unavailable' | 'not-found', code: string, message: string,
    related?: readonly SourceLocation[]): BlockResolution => ({ status, diagnostics: [issue(code, message, location, related)] });
  if (!from || !data) return failure('unavailable', 'UNAVAILABLE_INSTANCE', 'Instance does not belong to this analysis.');
  if (from.diagnostics.some(diagnostic => diagnostic.code === 'INVALID_INSTANCE_CONTEXT')) {
    return failure('unavailable', 'UNAVAILABLE_INSTANCE', 'Supplied instance context is ambiguous.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(reference.id)
    || (reference.qualifier !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reference.qualifier))) {
    return failure('unavailable', 'INVALID_BLOCK_REFERENCE', 'Reference has an invalid ID or project qualifier.');
  }
  let targetInstance = from;
  if (reference.qualifier !== undefined) {
    const bindings = data.aliases.get(reference.qualifier);
    if (!bindings) return failure('unavailable', 'UNKNOWN_PROJECT_ALIAS', `Unknown project alias: ${reference.qualifier}.`);
    if (bindings.length !== 1) return failure('unavailable', 'INVALID_ALIAS_BINDING', `Alias has multiple bindings: ${reference.qualifier}.`);
    const binding = bindings[0]!;
    if (!binding.target || binding.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
      return { status: 'unavailable', diagnostics: binding.diagnostics.map(diagnostic => ({ ...diagnostic,
        ...(location ? { location } : {}) })) };
    }
    targetInstance = binding.target;
  }
  const targetIndex = all.get(targetInstance);
  if (!targetInstance.available || !targetIndex) {
    return failure('unavailable', 'UNAVAILABLE_SOURCE', 'A complete, unambiguous source inventory is unavailable.');
  }
  const matches = targetIndex.ids.get(reference.id) ?? [];
  if (matches.length === 0) return failure('not-found', 'BLOCK_NOT_FOUND', `Block not found: ${reference.id}.`);
  if (matches.length > 1) return { status: 'ambiguous', candidates: [...matches], diagnostics: [issue(
    'AMBIGUOUS_BLOCK_REFERENCE', `Block ID has multiple definitions: ${reference.id}.`, location,
    matches.map(definitionLocation))] };
  return { status: 'resolved', target: matches[0]!, diagnostics: [] };
}

export function resolveBlockReference(scope: AnalysisScope, from: InstanceContext | undefined,
  reference: BlockReference, location?: SourceLocation): BlockResolution {
  const ownedLocation = location ? { sourceId: location.sourceId, range: { ...location.range },
    ...(from && index(scope).has(from) ? { instance: from.handle } : {}) } : undefined;
  const result = lookupBlockReference(scope, from, reference, ownedLocation);
  // Copy externally supplied locations before freezing; query inputs remain caller-owned.
  const diagnostics = result.status === 'resolved' ? subtreeDiagnostics([result.target]) : result.diagnostics;
  return freezeOwned({ ...result, diagnostics: diagnostics.map(diagnostic => copyDiagnostic(diagnostic)) });
}

function copyDiagnostic(diagnostic: Diagnostic): Diagnostic {
  const copy = (location: SourceLocation): SourceLocation => ({ ...location, range: { ...location.range } });
  return { ...diagnostic, ...(diagnostic.location ? { location: copy(diagnostic.location) } : {}),
    ...(diagnostic.related ? { related: diagnostic.related.map(copy) } : {}) };
}

export function findBlocksByTag(scope: AnalysisScope, instance: InstanceContext | undefined, tag: string): {
  readonly blocks: readonly Definition[];
  readonly classificationComplete: boolean;
  readonly diagnostics: readonly Diagnostic[];
} {
  const data = instance === undefined ? undefined : index(scope).get(instance);
  if (!instance || !data) return freezeOwned({ blocks: [], classificationComplete: false,
    diagnostics: [issue('UNAVAILABLE_INSTANCE', 'Instance does not belong to this analysis.')] });
  if (tag.length === 0 || /[\p{Cc}\u2028\u2029]/u.test(tag)) return freezeOwned({ blocks: [], classificationComplete: false,
    diagnostics: [issue('INVALID_TAG_QUERY', 'Tag query must be a nonempty name without controls or line breaks.')] });
  const blocks = [...(data.tags.get(tag.normalize('NFC')) ?? [])];
  const known = new Set(blocks);
  const uncertain = data.incomplete.filter(definition => !known.has(definition));
  // An incomplete field on an already-known match cannot add another match for this query.
  const classificationComplete = instance.available && uncertain.length === 0;
  const diagnostics = subtreeDiagnostics(blocks);
  if (!classificationComplete) diagnostics.push(issue('INCOMPLETE_TAG_CLASSIFICATION',
    'Additional matching Blocks may be unknown in this instance.', undefined, uncertain.map(definitionLocation)));
  return freezeOwned({ blocks, classificationComplete, diagnostics });
}
