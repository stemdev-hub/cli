import { planDeleteBlock } from '@stemdev/core';
import type { DeleteOptions, MutationResult } from '../types/index.js';
import { mutate } from './mutation.js';
export async function deleteBlock(
  id: string,
  options: DeleteOptions = {}
): Promise<MutationResult> {
  return mutate(options, async (project) => {
    const plan = planDeleteBlock(project.analysis, id, options.force);
    if (!plan.success) return { plan };
    const ids = new Set(plan.definitions.map((d) => d.id));
    const references = Object.values(project.config.outputSets)
      .flatMap((set) => set.targets)
      .filter((target) => target.source.kind === 'block' && ids.has(target.source.ref));
    if (references.length && !options.force)
      throw new Error('Configured outputs select the Block or a descendant.');
    return { plan, additionalReferences: references.length };
  });
}
