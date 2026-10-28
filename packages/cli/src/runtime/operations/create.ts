import { planCreateBlock } from '@stemdev/core';
import type { CreateBlockOptions, MutationResult } from '../types/index.js';
import { editDestination, mutate } from './mutation.js';
export async function createBlock(
  id: string,
  options: CreateBlockOptions
): Promise<MutationResult> {
  return mutate(options, async (project) => ({
    plan: planCreateBlock(
      project.analysis,
      id,
      await editDestination(project, options.destination),
      options.tags
    )
  }));
}
