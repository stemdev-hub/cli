import type { RenameResult } from '@stem/types';

// TODO: Rename a block ID and update all @stem[block:<id>] references safely.
export async function renameBlock(oldId: string, newId: string): Promise<RenameResult> {
  void oldId;
  void newId;
  throw new Error('TODO: implement rename operation.');
}
