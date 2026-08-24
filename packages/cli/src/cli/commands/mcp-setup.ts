import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';

interface ClaudeConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

function getAntigravityConfigPath(): string {
  return path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
}

function askQuestion(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    input: process.stdin as unknown as NodeJS.ReadableStream,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    output: process.stdout as unknown as NodeJS.WritableStream,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function getClaudeConfigPath(): string | null {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'win32') {
    const appData = process.env['APPDATA'] || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  return null;
}

function patchJsonConfig(configPath: string): boolean {
  try {
    const content = readFileSync(configPath, 'utf8');
    
    let config: ClaudeConfig = {};
    if (content.trim()) {
      config = JSON.parse(content) as ClaudeConfig;
    }

    if (!config['mcpServers']) {
      config['mcpServers'] = {};
    }

    if (config['mcpServers']['stem']) {
      console.log('Stem MCP is already configured in this file. Updating...');
    }

    config['mcpServers']['stem'] = {
      command: "npx",
      args: ["-y", "@stemdev/cli@latest", "mcp"],
      cwd: process.cwd()
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Failed to update ${configPath}:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

export async function runMcpSetup(): Promise<void> {
  let configuredAny = false;

  // 1. Antigravity Configuration
  const antigravityPath = getAntigravityConfigPath();
  if (existsSync(antigravityPath)) {
    const confirm = await askQuestion(
      'Found Antigravity IDE configuration. Do you want to configure it globally to use the Stem MCP server for this project? [Y/n] '
    );
    if (confirm) {
      if (patchJsonConfig(antigravityPath)) {
        console.log(`Successfully updated Antigravity config. Please restart Antigravity.`);
        configuredAny = true;
      }
    } else {
      console.log('Skipped Antigravity.');
    }
  }

  // 2. Claude CLI / Desktop
  let hasClaudeCli = false;
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore' });
    hasClaudeCli = true;
  } catch {
    // claude CLI not found
  }

  if (hasClaudeCli) {
    const confirm = await askQuestion(
      'Found Claude CLI. Do you want to configure Claude globally to use the Stem MCP server for this project? [Y/n] '
    );
    if (confirm) {
      try {
        execFileSync('claude', ['mcp', 'add', 'stem', '--', 'stem', 'mcp'], { stdio: 'inherit' });
        console.log('Successfully configured Stem MCP via Claude CLI.');
        configuredAny = true;
      } catch (e) {
        console.error('Failed to configure via Claude CLI:', e instanceof Error ? e.message : String(e));
      }
    } else {
      console.log('Skipped Claude.');
    }
  } else {
    if (os.platform() === 'linux') {
      console.log('Claude Desktop is not supported on Linux. Install the Claude CLI and try again.');
    } else {
      const configPath = getClaudeConfigPath();
      if (configPath && existsSync(configPath)) {
        const confirm = await askQuestion(
          'Found Claude Desktop configuration. Do you want to configure it globally to use the Stem MCP server for this project? [Y/n] '
        );
        if (confirm) {
          if (patchJsonConfig(configPath)) {
            console.log(`Successfully updated Claude Desktop config. Please restart Claude Desktop.`);
            configuredAny = true;
          }
        } else {
          console.log('Skipped Claude Desktop.');
        }
      }
    }
  }

  if (!configuredAny) {
    console.log('No AI assistants were configured.');
  }
}
