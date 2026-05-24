import type { Command } from 'commander';
import { renameBlock } from '../../core/operations/rename.js';

// TODO: Wire `stem rename <old-id> <new-id>` to the safe core rename operation.
export function registerRenameCommand(program: Command): void {
  program
    .command('rename <oldId> <newId>')
    .description('Safely rename a block ID')
    .action(async (oldId: string, newId: string) => {
      await renameBlock(oldId, newId);
    });
}
