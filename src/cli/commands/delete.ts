import type { Command } from 'commander';
import { deleteBlock, deleteView } from '../../core/operations/delete.js';

// TODO: Wire `stem delete` subcommands and force handling to core delete operations.
export function registerDeleteCommand(program: Command): void {
  const del = program.command('delete').description('Delete Stem entities');
  del
    .command('block <id>')
    .option('--force')
    .action(async (id: string) => {
      await deleteBlock(id);
    });
  del.command('view <id>').action(async (id: string) => {
    await deleteView(id);
  });
}
