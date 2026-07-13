import type { Command } from 'commander';
import { listBlocks, listViews } from '../../core/operations/list.js';
import { reportListBlocks, reportListViews } from '../output.js';

export function registerListCommand(program: Command): void {
  const list = program.command('list').description('List Stem blocks and views');
  list
    .command('blocks')
    .option('--tag <tag>')
    .action(async (options: { tag?: string }) => {
      reportListBlocks(await listBlocks(options.tag === undefined ? {} : { tag: options.tag }));
    });
  list
    .command('views')
    .option('--block <blockId>')
    .action(async (options: { block?: string }) => {
      reportListViews(await listViews(options.block === undefined ? {} : { blockId: options.block }));
    });
}
