import type { Command } from 'commander';
import { loadStemConfig } from '../../core/config/index.js';
import { publishGraph } from '../../core/operations/publish.js';

export function registerPublishGraphCommand(program: Command): void {
  program
    .command('publish-graph')
    .description('Publish structural snapshot (validates JSON namespace matches config)')
    .action(async () => {
      const configResult = await loadStemConfig(process.cwd());
      if (!configResult.success) {
        console.error(`Error loading configuration: ${configResult.error.message}`);
        process.exit(1);
      }

      const publishResult = await publishGraph(configResult.data);
      if (!publishResult.success) {
        console.error(`Error: ${publishResult.error.message}`);
        process.exit(1);
      }

      console.log(`\nSuccessfully published graph for namespace "${publishResult.data.namespace}" to ${publishResult.data.uploadedTo}`);
    });
}
