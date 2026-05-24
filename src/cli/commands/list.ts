import type { Command } from 'commander';
import { listBlocks, listViews } from '../../core/operations/list.js';

// TODO: Wire `stem list` subcommands to graph-backed listing operations.
export function registerListCommand(program: Command): void {
  const list = program.command('list').description('List Stem blocks and views');
  list
    .command('blocks')
    .option('--tag <tag>')
    .action(async () => {
      await listBlocks();
    });
  list
    .command('views')
    .option('--block <blockId>')
    .action(async () => {
      await listViews();
    });
}
