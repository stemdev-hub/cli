import type { Command } from 'commander';
import { deleteBlock } from '../../runtime/operations/delete.js';
import { reportMutation } from '../output.js';
export function registerDeleteCommand(program: Command): void {
  program
    .command('delete')
    .description('Delete authored definitions')
    .command('block <id>')
    .option('--force')
    .action(async (id: string, options: { force?: boolean }) => {
      reportMutation(await deleteBlock(id, { force: options.force ?? false }));
    });
}
