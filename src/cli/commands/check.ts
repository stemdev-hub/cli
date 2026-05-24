import type { Command } from 'commander';
import { checkProject } from '../../core/operations/check.js';

// TODO: Wire `stem check` to read-only validation and terminal diagnostics.
export function registerCheckCommand(program: Command): void {
  program
    .command('check')
    .description('Validate Stem files without writing changes')
    .action(async () => {
      await checkProject();
    });
}
