import type { Command } from 'commander';
import { cleanupOutputs } from '../../runtime/operations/cleanup.js';
import { reportCleanup } from '../output.js';
export function registerCleanupCommand(program: Command): void {
  program
    .command('cleanup')
    .description(
      'Assess obsolete output ownership; use --apply to delete unchanged obsolete outputs'
    )
    .requiredOption('--output-dir <dir>')
    .requiredOption('--set <name>')
    .option('--apply')
    .action(async (options: { outputDir: string; set: string; apply?: boolean }) => {
      reportCleanup(await cleanupOutputs(options));
    });
}
