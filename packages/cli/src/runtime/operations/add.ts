import { planAddInclusion } from '@stemdev/core';
import type { AddInclusionOptions, MutationResult } from '../types/index.js';
import { editDestination, mutate } from './mutation.js';
export async function addInclusion(
  reference: string,
  options: AddInclusionOptions
): Promise<MutationResult> {
  return mutate(options, async (project) => ({
    plan: planAddInclusion(
      project.analysis,
      reference,
      await editDestination(project, options.destination)
    )
  }));
}
