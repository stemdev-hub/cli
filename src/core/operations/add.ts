import type { AddRefOptions, AddRefResult, OperationResult } from '@stem/types';

// TODO: Insert block transclusion references into view files.
export async function addBlockToView(
  blockId: string,
  viewId: string,
  options: AddRefOptions = {}
): Promise<OperationResult<AddRefResult>> {
  void blockId;
  void viewId;
  void options;
  throw new Error('TODO: implement add reference operation.');
}
