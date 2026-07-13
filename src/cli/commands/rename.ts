import type { Command } from 'commander';
import { renameBlock } from '../../core/operations/rename.js';
import { reportRename } from '../output.js';

export function registerRenameCommand(program: Command): void {
  program
    .command('rename <oldId> <newId>')
    .description('Safely rename a block ID')
    .action(async (oldId: string, newId: string) => {
      reportRename(await renameBlock(oldId, newId));
    });
}
