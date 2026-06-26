import type {
  CreateBlockOptions,
  CreateBlockResult,
  CreateGroupResult,
  CreateViewOptions,
  CreateViewResult,
  OperationResult,
  ProjectOperationOptions
} from '@stem/types';

// TODO: Create block, view, and group files with minimal frontmatter scaffolds.
export async function createBlock(
  name: string,
  options: CreateBlockOptions = {}
): Promise<OperationResult<CreateBlockResult>> {
  void name;
  void options;
  throw new Error('TODO: implement create block operation.');
}

export async function createView(
  name: string,
  options: CreateViewOptions = {}
): Promise<OperationResult<CreateViewResult>> {
  void name;
  void options;
  throw new Error('TODO: implement create view operation.');
}

export async function createGroup(
  groupPath: string,
  options: ProjectOperationOptions = {}
): Promise<OperationResult<CreateGroupResult>> {
  void groupPath;
  void options;
  throw new Error('TODO: implement create group operation.');
}
