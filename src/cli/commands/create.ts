import type { Command } from 'commander';
import { createBlock, createGroup, createView } from '../../core/operations/create.js';

// TODO: Wire `stem create` subcommands to core create operations.
export function registerCreateCommand(program: Command): void {
  const create = program.command('create').description('Create Stem blocks, views, and groups');
  create.command('block <name>').action(async (name: string) => {
    await createBlock(name);
  });
  create.command('view <name>').action(async (name: string) => {
    await createView(name);
  });
  create.command('group <path>').action(async (groupPath: string) => {
    await createGroup(groupPath);
  });
}
