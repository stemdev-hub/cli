import { Option } from 'commander';
import type { Command } from 'commander';
import { createBlock } from '../../runtime/operations/create.js';
import { reportMutation } from '../output.js';
export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create authored Blocks')
    .command('block <id>')
    .addOption(new Option('--file <path>').conflicts('parent'))
    .addOption(new Option('--parent <id>').conflicts('file'))
    .option(
      '--tag <tag>',
      'Direct Tag; repeat to add more',
      (value: string, previous: string[]) => [...previous, value],
      []
    )
    .action(
      async (
        id: string,
        options: { file?: string; parent?: string; tag: string[] },
        command: Command
      ) => {
        if (options.file === undefined && options.parent === undefined) {
          command.error('Exactly one of --file or --parent is required.');
          return;
        }
        reportMutation(
          await createBlock(id, {
            destination:
              options.file !== undefined
                ? { kind: 'file', path: options.file }
                : { kind: 'block', id: options.parent! },
            tags: options.tag
          })
        );
      }
    );
}
