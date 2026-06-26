import type { OperationResult, ProjectOperationOptions, SyncResult } from '@stem/types';

// TODO: Rebuild the dynamic connection graph cache using invalidated files only.
export async function syncProject(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<SyncResult>> {
  void options;
  throw new Error('TODO: implement sync operation.');
}
