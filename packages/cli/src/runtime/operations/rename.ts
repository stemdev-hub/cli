import path from 'node:path';
import { planRenameBlock } from '@stemdev/core';
import type { ExternalRenameEntry } from '@stemdev/core';
import type { MutationResult, ProjectOperationOptions } from '../types/index.js';
import { mutate, optionalText } from './mutation.js';
import type { AuxiliaryEdit } from './mutation.js';
export async function renameBlock(
  oldId: string,
  newId: string,
  options: ProjectOperationOptions = {}
): Promise<MutationResult> {
  return mutate(options, async (project) => {
    const plan = planRenameBlock(project.analysis, oldId, newId);
    if (!plan.success || oldId === newId) return { plan };
    const auxiliary: AuxiliaryEdit[] = [];
    const historyPath = path.join(project.projectRoot, '.stem/renames.json');
    const before = await optionalText(historyPath);
    const history: unknown = before === undefined ? [] : JSON.parse(before);
    if (
      !Array.isArray(history) ||
      !history.every(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          Object.keys(item).every((key) => ['from', 'to', 'since'].includes(key)) &&
          'from' in item &&
          typeof item.from === 'string' &&
          'to' in item &&
          typeof item.to === 'string' &&
          'since' in item &&
          typeof item.since === 'string'
      )
    )
      throw new Error('Rename history is invalid.');
    const raw = JSON.parse(project.configText) as {
      outputSets?: Record<string, { targets: { source: { kind: string; ref?: string } }[] }>;
    };
    let additionalReferences = 0;
    for (const set of Object.values(raw.outputSets ?? {}))
      for (const target of set.targets)
        if (target.source.kind === 'block' && target.source.ref === oldId) {
          target.source.ref = newId;
          additionalReferences++;
        }
    if (additionalReferences)
      auxiliary.push({
        path: path.join(project.projectRoot, '.stem/config.json'),
        before: project.configText,
        after: JSON.stringify(raw, null, 2) + '\n',
        stage: 'configuration'
      });
    auxiliary.push({
      path: historyPath,
      before,
      after:
        JSON.stringify(
          [
            ...(history as ExternalRenameEntry[]),
            { from: oldId, to: newId, since: new Date().toISOString() }
          ],
          null,
          2
        ) + '\n',
      stage: 'history'
    });
    return { plan, auxiliary, additionalReferences };
  });
}
