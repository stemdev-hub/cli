import type { Command } from 'commander';
import { addInclusion } from '../../runtime/operations/add.js';
import { reportMutation } from '../output.js';
export function registerAddCommand(program: Command): void {
  program
    .command('add <ref> <to> <kind> <destination>')
    .description('Insert an inclusion: add <ref> to block <id> | file <path>')
    .action(
      async (
        ref: string,
        to: string,
        kind: string,
        destination: string,
        _options: unknown,
        command: Command
      ) => {
        if (to !== 'to' || (kind !== 'file' && kind !== 'block')) {
          command.error('Use add <ref> to block <id> or add <ref> to file <path>.');
          return;
        }
        reportMutation(
          await addInclusion(ref, {
            destination: kind === 'file' ? { kind, path: destination } : { kind, id: destination }
          })
        );
      }
    );
}
