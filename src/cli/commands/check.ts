import type { Command } from 'commander';
import { checkProject } from '../../core/operations/check.js';
import { reportCheck } from '../output.js';

export function registerCheckCommand(program: Command): void {
  program
    .command('check')
    .description('Validate Stem files without writing changes')
    .action(async () => {
      reportCheck(await checkProject());
    });
}
