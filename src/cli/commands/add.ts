import type { Command } from 'commander';
import { addBlockToView } from '../../core/operations/add.js';
import { reportAdd } from '../output.js';

export function registerAddCommand(program: Command): void {
  program
    .command('add <blockId> to <viewId>')
    .option('--section <section>')
    .option('--tag <tag>')
    .action(async (blockId: string, viewId: string, options: { section?: string; tag?: string }) => {
      reportAdd(
        await addBlockToView(blockId, viewId, {
          ...(options.section === undefined ? {} : { section: options.section }),
          ...(options.tag === undefined ? {} : { tag: options.tag })
        })
      );
    });
}
