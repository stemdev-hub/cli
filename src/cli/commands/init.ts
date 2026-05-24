import type { Command } from 'commander';
import { initProject } from '../../core/operations/init.js';

// TODO: Wire `stem init` CLI options to the core init operation.
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a Stem project')
    .action(async () => {
      await initProject();
    });
}
