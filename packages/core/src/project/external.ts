import { isExternalStemGraphShape } from '../types/graph.js';
import type { ExternalSnapshotState, ExternalBlockEntry } from '../types/graph.js';
import type { ProjectAnalysis } from './model.js';
import { freezeOwned, issue } from './model.js';
import type { Diagnostic } from '../parser/syntax.js';
/** Decode JSON-parsed input, copying ownership without checking date validity. */
export function decodeExternalSnapshotEnvelope(value: unknown): ExternalSnapshotState | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const envelope = value as { fetchedAt?: unknown; graph?: unknown };
  if (typeof envelope.fetchedAt !== 'string' || !isExternalStemGraphShape(envelope.graph))
    return undefined;
  const graph = envelope.graph;
  return freezeOwned({
    fetchedAt: envelope.fetchedAt,
    isLocalFallback: false,
    graph: {
      ...graph,
      blocks: graph.blocks.map((block) => ({ ...block, tags: [...block.tags] })),
      renames: graph.renames.map((rename) => ({ ...rename }))
    }
  });
}
/** A complete local metadata projection; body/reference errors do not replace metadata validity. */
export function projectExternalBlocks(analysis: ProjectAnalysis): {
  readonly complete: boolean;
  readonly blocks: readonly ExternalBlockEntry[];
  readonly diagnostics: readonly Diagnostic[];
} {
  const definitions = analysis.localInstance?.sources.flatMap((source) => source.definitions) ?? [];
  const ids = new Set<string>();
  const invalid =
    !analysis.localInstance?.available ||
    definitions.some((definition) => {
      if (
        !definition.id ||
        ids.has(definition.id) ||
        !definition.classificationComplete ||
        definition.syntax.header.fields.some(
          (field) => !field.valid || (field.name !== 'id' && field.name !== 'tags')
        )
      )
        return true;
      ids.add(definition.id);
      return false;
    });
  if (invalid)
    return freezeOwned({
      complete: false,
      blocks: [],
      diagnostics: [
        issue(
          'INVALID_EXTERNAL_METADATA',
          'A complete inventory with unique valid IDs and valid direct Tags is required.'
        )
      ]
    });
  return freezeOwned({
    complete: true,
    blocks: definitions
      .map((definition) => ({ id: definition.id!, tags: [...definition.tags] }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    diagnostics: []
  });
}
