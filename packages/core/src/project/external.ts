import { isExternalStemGraphShape } from '../types/graph.js';
import type { ExternalSnapshotState } from '../types/graph.js';

/** Decode an already JSON-parsed cache envelope; date validity is not checked. */
export function decodeExternalSnapshotEnvelope(value: unknown): ExternalSnapshotState | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const envelope = value as { fetchedAt?: unknown; graph?: unknown };
  if (typeof envelope.fetchedAt !== 'string' || !isExternalStemGraphShape(envelope.graph)) return undefined;
  return { graph: envelope.graph, fetchedAt: envelope.fetchedAt, isLocalFallback: false };
}
