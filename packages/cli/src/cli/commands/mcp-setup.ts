import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface McpConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export interface McpSetupOptions {
  /** Skip all interactive prompts and apply recommended defaults. */
  yes: boolean;
}

type AntigravityScope = 'local' | 'global' | 'skip';
type ClaudeCliScope = 'local' | 'project' | 'global' | 'skip';

interface Choice<T extends string> {
  label: string;
  hint: string;
  value: T;
}

// ---------------------------------------------------------------------------
// Prompt helpers (zero external dependencies — plain readline)
// ---------------------------------------------------------------------------

/**
 * Renders a numbered list and returns the value of the chosen option.
 * Pressing Enter with no input selects the first option (default).
 */
function askSelect<T extends string>(
  question: string,
  choices: Choice<T>[],
): Promise<T> {
  const rl = readline.createInterface({
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    input: process.stdin as unknown as NodeJS.ReadableStream,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    output: process.stdout as unknown as NodeJS.WritableStream,
  });

  const lines = [
    `\n  ${question}`,
    ...choices.map((c, i) => `    ${i + 1}. ${c.label}  – ${c.hint}`),
    '',
  ];
  process.stdout.write(lines.join('\n'));

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(`  Enter number [1-${choices.length}] (default 1): `, (answer) => {
        const trimmed = answer.trim();
        if (trimmed === '') {
          rl.close();
          resolve(choices[0]!.value);
          return;
        }
        const num = Number(trimmed);
        const idx = num - 1;
        if (Number.isInteger(num) && idx >= 0 && idx < choices.length) {
          rl.close();
          resolve(choices[idx]!.value);
        } else {
          process.stdout.write(`  Invalid choice. Please enter a number between 1 and ${choices.length}.\n`);
          ask();
        }
      });
    };
    ask();
  });
}

/**
 * Simple Y/N confirmation.
 * Returns true for 'y'/'yes'/empty Enter (default yes).
 */
function askConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    input: process.stdin as unknown as NodeJS.ReadableStream,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    output: process.stdout as unknown as NodeJS.WritableStream,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === '' || trimmed === 'y' || trimmed === 'yes');
    });
  });
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getAntigravityGlobalConfigPath(): string {
  return path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
}

function getClaudeDesktopConfigPath(): string | null {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'win32') {
    const appData = process.env['APPDATA'] ?? path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  return null;
}

function patchJsonConfig(configPath: string): boolean {
  try {
    const dir = path.dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let content = '{}';
    if (existsSync(configPath)) {
      content = readFileSync(configPath, 'utf8');
    }

    let config: McpConfig = {};
    if (content.trim()) {
      config = JSON.parse(content) as McpConfig;
    }

    if (!config['mcpServers']) {
      config['mcpServers'] = {};
    }

    if (config['mcpServers']['stem']) {
      console.log('  Stem MCP is already configured in this file. Updating...');
    }

    config['mcpServers']['stem'] = {
      command: 'npx',
      args: ['-y', '@stemdev/cli@latest', 'mcp'],
      cwd: process.cwd(),
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`  Failed to update ${configPath}:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main setup flow
// ---------------------------------------------------------------------------

export async function runMcpSetup(options: McpSetupOptions = { yes: false }): Promise<void> {
  const { yes } = options;
  let configuredAny = false;

  // ── 1. Antigravity ────────────────────────────────────────────────────────
  console.log('\n  Configuring Antigravity IDE...');

  const localAntigravityPath = path.join(process.cwd(), '.agents', 'mcp_config.json');
  const globalAntigravityPath = getAntigravityGlobalConfigPath();

  const antigravityScope: AntigravityScope = yes
    ? 'local'
    : await askSelect<AntigravityScope>(
        'How do you want to configure Stem MCP for Antigravity?',
        [
          {
            value: 'local',
            label: 'Local ',
            hint: '.agents/mcp_config.json in this project (commit to share with team)',
          },
          {
            value: 'global',
            label: 'Global',
            hint: `${globalAntigravityPath} (this machine only)`,
          },
          { value: 'skip', label: 'Skip  ', hint: 'do nothing' },
        ],
      );

  if (antigravityScope === 'local') {
    if (patchJsonConfig(localAntigravityPath)) {
      console.log('  ✓ Updated local Antigravity config. Please restart Antigravity.');
      console.log('  Tip: commit .agents/mcp_config.json so teammates get this config automatically.');
      configuredAny = true;
    }
  } else if (antigravityScope === 'global') {
    if (patchJsonConfig(globalAntigravityPath)) {
      console.log('  ✓ Updated global Antigravity config. Please restart Antigravity.');
      configuredAny = true;
    }
  } else {
    console.log('  Skipped Antigravity.');
  }

  // ── 2. Claude Code CLI / Desktop ──────────────────────────────────────────
  let hasClaudeCli = false;
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore' });
    hasClaudeCli = true;
  } catch {
    // claude CLI not found
  }

  if (hasClaudeCli) {
    // ── 2a. Claude Code CLI (three real scopes + skip) ───────────────────────
    console.log('\n  Found Claude Code CLI...');

    const claudeCliScope: ClaudeCliScope = yes
      ? 'local'
      : await askSelect<ClaudeCliScope>(
          'How do you want to configure Stem MCP for Claude Code?',
          [
            {
              value: 'local',
              label: 'Local  ',
              hint: 'private to you, this project only (.claude/settings.local.json)',
            },
            {
              value: 'project',
              label: 'Project',
              hint: 'shared with your team (.mcp.json at project root)',
            },
            {
              value: 'global',
              label: 'Global ',
              hint: 'all your projects (~/.claude.json)',
            },
            { value: 'skip', label: 'Skip   ', hint: 'do nothing' },
          ],
        );

    if (claudeCliScope !== 'skip') {
      try {
        const scopeArgs: string[] =
          claudeCliScope === 'project'
            ? ['--scope', 'project']
            : claudeCliScope === 'global'
              ? ['--scope', 'user']
              : []; // 'local' is the default — no flag needed

        execFileSync(
          'claude',
          ['mcp', 'add', ...scopeArgs, 'stem', '--', 'npx', '-y', '@stemdev/cli@latest', 'mcp'],
          { stdio: 'inherit' },
        );
        console.log('  ✓ Configured Stem MCP via Claude Code CLI.');
        configuredAny = true;
      } catch (e) {
        console.error('  Failed to configure via Claude Code CLI:', e instanceof Error ? e.message : String(e));
      }
    } else {
      console.log('  Skipped Claude Code CLI.');
    }
  } else {
    // ── 2b. Claude Desktop fallback (global-only — auto-announce + Y/N) ──────
    if (os.platform() === 'linux') {
      console.log('\n  Claude Desktop is not supported on Linux. Install the Claude CLI and try again.');
    } else {
      const desktopConfigPath = getClaudeDesktopConfigPath();
      if (desktopConfigPath && existsSync(desktopConfigPath)) {
        console.log(`\n  Found Claude Desktop (${desktopConfigPath})`);
        console.log('  Note: Claude Desktop only supports a single global configuration.\n');

        const configure = yes || (await askConfirm('  Configure it to use Stem MCP? [Y/n] '));

        if (configure) {
          if (patchJsonConfig(desktopConfigPath)) {
            console.log('  ✓ Updated Claude Desktop config. Please restart Claude Desktop.');
            configuredAny = true;
          }
        } else {
          console.log('  Skipped Claude Desktop.');
        }
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  if (!configuredAny) {
    console.log('  No AI assistants were configured.');
  }
}
