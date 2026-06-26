import type { OperationResult, ProjectOperationOptions, RenameResult } from '@stem/types';

// TODO: Rename a block ID and update all @stem[block:<id>] references safely.
export async function renameBlock(
  oldId: string,
  newId: string,
  options: ProjectOperationOptions = {}
): Promise<OperationResult<RenameResult>> {
  void oldId;
  void newId;
  void options;
  throw new Error('TODO: implement rename operation.');
}
