import type { Command } from 'commander';
import { checkProject } from '../../core/operations/check.js';
import { reportCheck } from '../output.js';

export function registerCheckCommand(program: Command): void {
  program
    .command('check')
    .description('Validate Stem files without writing changes')
    .option('--strict-external', 'Promote external reference warnings to errors')
    .option('--use-remote', 'Bypass local paths and force remote snapshot validation')
    .option('--json', 'Output results in JSON format')
    .action(async (options: { strictExternal?: boolean; useRemote?: boolean; json?: boolean }) => {
      reportCheck(await checkProject({ 
        startDir: process.cwd(),
        ...(options.strictExternal !== undefined ? { strictExternal: options.strictExternal } : {}),
        ...(options.useRemote !== undefined ? { useRemote: options.useRemote } : {})
      }), options.json);
    });
}
