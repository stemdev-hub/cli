import type { CreateBlockResult, CreateGroupResult, CreateViewResult } from '@stem/types';

// TODO: Create block, view, and group files with minimal frontmatter scaffolds.
export async function createBlock(name: string): Promise<CreateBlockResult> {
  void name;
  throw new Error('TODO: implement create block operation.');
}

export async function createView(name: string): Promise<CreateViewResult> {
  void name;
  throw new Error('TODO: implement create view operation.');
}

export async function createGroup(groupPath: string): Promise<CreateGroupResult> {
  void groupPath;
  throw new Error('TODO: implement create group operation.');
}
