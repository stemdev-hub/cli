import type { Command } from 'commander';
import { syncProject } from '../../core/operations/sync.js';

// TODO: Wire `stem sync` to cache invalidation and graph snapshot orchestration.
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Rebuild the dynamic Stem graph cache')
    .action(async () => {
      await syncProject();
    });
}
