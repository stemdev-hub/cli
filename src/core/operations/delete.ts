import type { DeleteOptions, DeleteResult, OperationResult } from '@stem/types';

// TODO: Delete blocks and views after dynamic reference checks and force handling.
export async function deleteBlock(
  id: string,
  options: DeleteOptions = {}
): Promise<OperationResult<DeleteResult>> {
  void id;
  void options;
  throw new Error('TODO: implement delete block operation.');
}

export async function deleteView(
  id: string,
  options: DeleteOptions = {}
): Promise<OperationResult<DeleteResult>> {
  void id;
  void options;
  throw new Error('TODO: implement delete view operation.');
}
