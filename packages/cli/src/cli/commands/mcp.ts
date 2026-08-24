import type { Command } from 'commander';

export function registerMcpCommand(program: Command): void {
  const mcpCmd = program
    .command('mcp')
    .description('Start the Stem MCP server (Stdio transport)')
    .action(async () => {
      // 1. Initialize stdout protection before anything else is imported
      const { setupStdioGuard } = await import('../../mcp/stdio-guard.js');
      setupStdioGuard();

      // 2. Now it's safe to import and start the server
      const { startMcpServer } = await import('../../mcp/server.js');
      startMcpServer();
    });

  mcpCmd
    .command('setup')
    .description('Configure an AI assistant to use Stem MCP in this workspace')
    .option('-y, --yes', 'Non-interactive: skip all prompts and apply recommended defaults (local scope)')
    .action(async (opts: { yes?: boolean }) => {
      const { runMcpSetup } = await import('./mcp-setup.js');
      await runMcpSetup({ yes: opts.yes ?? false });
    });
}
