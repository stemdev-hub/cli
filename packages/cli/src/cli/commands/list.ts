import type { Command } from 'commander';
import { listBlocks, listViews } from '../../core/operations/list.js';
import { reportListBlocks, reportListViews } from '../output.js';

export function registerListCommand(program: Command): void {
  const list = program.command('list').description('List Stem blocks and views');
  list
    .command('blocks')
    .option('--tag <tag>')
    .option('--json', 'Output results in JSON format')
    .action(async (options: { tag?: string; json?: boolean }) => {
      reportListBlocks(await listBlocks(options.tag === undefined ? {} : { tag: options.tag }), options.json);
    });
  list
    .command('views')
    .option('--block <blockId>')
    .option('--json', 'Output results in JSON format')
    .action(async (options: { block?: string; json?: boolean }) => {
      reportListViews(await listViews(options.block === undefined ? {} : { blockId: options.block }), options.json);
    });
}
