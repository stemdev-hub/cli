import type { Command } from 'commander';
import { initProject } from '../../runtime/operations/init.js';
import { reportInit } from '../output.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a Stem project')
    .option('--force', 'complete missing scaffolding while preserving valid configuration and identity')
    .action(async (options: { force?: boolean }) => {
      reportInit(await initProject({ force: options.force ?? false }));
    });
}
