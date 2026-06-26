import type { InitProjectOptions, InitResult, OperationResult } from '@stem/types';

// TODO: Create .stem/config.json, blocks, views, schemas, and gitignore entries.
export async function initProject(
  options: InitProjectOptions = {}
): Promise<OperationResult<InitResult>> {
  void options;
  throw new Error('TODO: implement init operation.');
}
