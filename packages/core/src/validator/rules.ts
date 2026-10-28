import type { ProjectAnalysis } from '../project/model.js';
import type { ExternalSnapshotState } from '../types/graph.js';
import type { NamespaceConfig } from '../types/config.js';
import type { Diagnostic } from '../parser/syntax.js';
import { freezeOwned } from '../project/model.js';
export interface ExternalValidationOptions {
  readonly nowMs: number;
  readonly strictExternal?: boolean;
}
/** Supplemental metadata assessment only: never resolves authored source or changes composition. */
export function validateExternalReferences(
  analysis: ProjectAnalysis,
  configured: Readonly<Record<string, NamespaceConfig>>,
  snapshots: ReadonlyMap<string, ExternalSnapshotState>,
  options: ExternalValidationOptions
): readonly Diagnostic[] {
  const result: Diagnostic[] = [];
  for (const source of analysis.localInstance?.sources ?? [])
    for (const occurrence of source.inclusions) {
      const alias = occurrence.syntax.target.qualifier;
      if (alias === undefined) continue;
      const snapshot = snapshots.get(alias);
      let code: string | undefined;
      let message = '';
      let severity: 'error' | 'warning' = options.strictExternal ? 'error' : 'warning';
      if (!Object.hasOwn(configured, alias)) {
        code = 'UNRESOLVED_NAMESPACE';
        message = 'Namespace is not configured: ' + alias;
      } else if (!snapshot) {
        code = 'MISSING_SNAPSHOT';
        message = 'No metadata snapshot is available: ' + alias;
      } else if (
        !snapshot.isLocalFallback &&
        options.nowMs - new Date(snapshot.fetchedAt).getTime() > 7 * 86400000
      ) {
        code = 'EXPIRED_SNAPSHOT';
        message = 'Metadata snapshot has expired: ' + alias;
      } else if (!snapshot.graph.blocks.some((block) => block.id === occurrence.syntax.target.id)) {
        code = 'BROKEN_BLOCK_REF';
        severity = 'error';
        message = 'External metadata has no Block: ' + alias + ':' + occurrence.syntax.target.id;
        const rename = snapshot.graph.renames.find(
          (item) => item.from === occurrence.syntax.target.id
        );
        if (rename) message += '. Renamed to ' + rename.to + ' (since ' + rename.since + ').';
      }
      if (code)
        result.push({
          code,
          message,
          severity,
          location: { sourceId: source.tree.source.sourceId, range: { ...occurrence.syntax.range } }
        });
    }
  return freezeOwned(result);
}
