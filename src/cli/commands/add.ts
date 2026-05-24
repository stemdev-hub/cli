import type { Command } from 'commander';
import { addBlockToView } from '../../core/operations/add.js';

// TODO: Wire `stem add <block-id> to <view-id>` to the core add operation.
export function registerAddCommand(program: Command): void {
  program
    .command('add <blockId> to <viewId>')
    .option('--section <section>')
    .option('--tag <tag>')
    .action(async (blockId: string, viewId: string) => {
      await addBlockToView(blockId, viewId);
    });
}
