import { isBlockId, isTagName } from '../parser/grammar.js';
export interface ExternalBlockEntry {
  readonly id: string;
  readonly tags: readonly string[];
}
export interface ExternalRenameEntry {
  readonly from: string;
  readonly to: string;
  readonly since: string;
}
export interface ExternalStemGraph {
  readonly version: '2';
  readonly projectId: string;
  readonly namespace: string;
  readonly publishedAt: string;
  readonly contentSha: string;
  readonly blocks: readonly ExternalBlockEntry[];
  readonly renames: readonly ExternalRenameEntry[];
}
export interface ExternalSnapshotState {
  readonly graph: ExternalStemGraph;
  readonly fetchedAt: string;
  readonly isLocalFallback: boolean;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
/** Replacement shape only. Timestamp strings deliberately remain permissive. */
export function isExternalStemGraphShape(value: unknown): value is ExternalStemGraph {
  if (
    !record(value) ||
    !keys(value, [
      'version',
      'projectId',
      'namespace',
      'publishedAt',
      'contentSha',
      'blocks',
      'renames'
    ]) ||
    value['version'] !== '2' ||
    typeof value['projectId'] !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value['projectId']
    ) ||
    value['projectId'].length !== 36 ||
    typeof value['namespace'] !== 'string' ||
    typeof value['publishedAt'] !== 'string' ||
    typeof value['contentSha'] !== 'string' ||
    !Array.isArray(value['blocks']) ||
    !Array.isArray(value['renames'])
  )
    return false;
  const ids = new Set<string>();
  for (const block of value['blocks'] as unknown[]) {
    if (
      !record(block) ||
      !keys(block, ['id', 'tags']) ||
      typeof block['id'] !== 'string' ||
      !isBlockId(block['id']) ||
      ids.has(block['id']) ||
      !Array.isArray(block['tags']) ||
      !(block['tags'] as unknown[]).every((tag) => typeof tag === 'string' && isTagName(tag))
    )
      return false;
    ids.add(block['id']);
  }
  return (value['renames'] as unknown[]).every(
    (rename) =>
      record(rename) &&
      keys(rename, ['from', 'to', 'since']) &&
      typeof rename['from'] === 'string' &&
      typeof rename['to'] === 'string' &&
      typeof rename['since'] === 'string'
  );
}
