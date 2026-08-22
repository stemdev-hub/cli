import type { Command } from 'commander';
import { syncProject } from '../../core/operations/sync.js';
import { reportSync } from '../output.js';

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Rebuild the dynamic Stem graph cache')
    .action(async () => {
      reportSync(await syncProject());
    });
}
