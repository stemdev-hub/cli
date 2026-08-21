import type { Command } from 'commander';
import { loadStemConfig } from '../../core/config/index.js';
import { fetchNamespaces } from '../../core/operations/fetch.js';

export function registerFetchNamespacesCommand(program: Command): void {
  program
    .command('fetch-namespaces')
    .description('Download external graph snapshots for all configured namespaces')
    .action(async () => {
      const configResult = await loadStemConfig(process.cwd());
      if (!configResult.success) {
        console.error(`Error loading configuration: ${configResult.error.message}`);
        process.exit(1);
      }

      const fetchResult = await fetchNamespaces(configResult.data);
      if (!fetchResult.success) {
        console.error(`Error: ${fetchResult.error.message}`);
        process.exit(1);
      }

      const { successes, skipped, warnings } = fetchResult.data;

      if (warnings.length > 0) {
        console.warn('\nWarnings:');
        for (const warning of warnings) {
          console.warn(`  - ${warning}`);
        }
      }

      console.log('\nFetch summary:');
      console.log(`  Fetched: ${successes.length}`);
      console.log(`  Skipped (localPath): ${skipped.length}`);
      console.log(`  Failed: ${warnings.length}`);
    });
}
