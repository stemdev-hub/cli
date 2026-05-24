import type { DeleteResult } from '@stem/types';

// TODO: Delete blocks and views after dynamic reference checks and force handling.
export async function deleteBlock(id: string): Promise<DeleteResult> {
  void id;
  throw new Error('TODO: implement delete block operation.');
}

export async function deleteView(id: string): Promise<DeleteResult> {
  void id;
  throw new Error('TODO: implement delete view operation.');
}
