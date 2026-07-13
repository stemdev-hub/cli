import type { Command } from 'commander';
import { deleteBlock, deleteView } from '../../core/operations/delete.js';
import { reportDelete } from '../output.js';

export function registerDeleteCommand(program: Command): void {
  const del = program.command('delete').description('Delete Stem entities');
  del
    .command('block <id>')
    .option('--force')
    .action(async (id: string, options: { force?: boolean }) => {
      reportDelete(await deleteBlock(id, { force: options.force ?? false }));
    });
  del.command('view <id>').action(async (id: string) => {
    reportDelete(await deleteView(id));
  });
}
