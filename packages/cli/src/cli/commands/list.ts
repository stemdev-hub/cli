import type { Command } from 'commander';
import { listBlocks, listReferences, listOutputs } from '../../runtime/operations/list.js';
import { reportQuery } from '../output.js';
export function registerListCommand(program: Command): void {
  const list = program
    .command('list')
    .description('Inspect Blocks, references and output mappings');
  list
    .command('blocks')
    .option('--tag <tag>')
    .option('--json')
    .action(async (options: { tag?: string; json?: boolean }) => {
      reportQuery(
        await listBlocks(options.tag === undefined ? {} : { tag: options.tag }),
        options.json
      );
    });
  list
    .command('references <id>')
    .option('--json')
    .action(async (id: string, options: { json?: boolean }) => {
      reportQuery(await listReferences(id), options.json);
    });
  list
    .command('outputs')
    .option('--json')
    .action(async (options: { json?: boolean }) => {
      reportQuery(await listOutputs(), options.json);
    });
}
