import type { ListBlocksResult, ListViewsResult, OperationResult, ProjectOperationOptions } from '@stem/types';

// TODO: List blocks and views using graph-backed metadata.
export async function listBlocks(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<ListBlocksResult>> {
  void options;
  throw new Error('TODO: implement list blocks operation.');
}

export async function listViews(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<ListViewsResult>> {
  void options;
  throw new Error('TODO: implement list views operation.');
}
