/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as child_process from 'node:child_process';
import * as readline from 'node:readline';
import * as os from 'node:os';

import { runMcpSetup } from '../../src/cli/commands/mcp-setup.js';

vi.mock('node:fs');
vi.mock('node:child_process');
vi.mock('node:readline');
vi.mock('node:os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate a sequence of readline answers (one per createInterface call). */
function mockReadlineAnswers(...answers: string[]) {
  let callCount = 0;
  vi.mocked(readline.createInterface).mockImplementation(() => {
    const answer = answers[callCount++] ?? '';
    return {
      question: vi.fn((_query: string, cb: (a: string) => void) => cb(answer)),
      close: vi.fn(),
    } as any;
  });
}

// ---------------------------------------------------------------------------
// Baseline mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

  vi.spyOn(os, 'platform').mockReturnValue('win32');
  vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\Test');

  // Default: no claude CLI, no claude desktop
  vi.mocked(child_process.execFileSync).mockImplementation(() => {
    throw new Error('not found');
  });
  // Default: no config files exist
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readFileSync).mockReturnValue('{}');
  vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
});

// ---------------------------------------------------------------------------
// --yes flag (non-interactive)
// ---------------------------------------------------------------------------

describe('--yes flag', () => {
  it('applies local scope for Antigravity without any prompts', async () => {
    await runMcpSetup({ yes: true });

    expect(readline.createInterface).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const writtenPath = String(vi.mocked(fs.writeFileSync).mock.calls[0]![0]);
    expect(writtenPath).toContain('.agents');
    expect(writtenPath).toContain('mcp_config.json');
  });

  it('does not prompt and configures Claude Code CLI with local scope', async () => {
    vi.mocked(child_process.execFileSync).mockImplementation((exe, args) => {
      if (exe === 'claude' && (args as string[])?.[0] === '--version') return Buffer.from('1.0');
      return Buffer.from('');
    });

    await runMcpSetup({ yes: true });

    expect(readline.createInterface).not.toHaveBeenCalled();
    // local = no --scope flag; command should NOT contain '--scope'
    const claudeCall = vi.mocked(child_process.execFileSync).mock.calls.find(
      (c) => c[0] === 'claude' && (c[1] as string[])?.[0] === 'mcp',
    );
    expect(claudeCall).toBeDefined();
    expect(claudeCall![1]).not.toContain('--scope');
  });
});

// ---------------------------------------------------------------------------
// Antigravity
// ---------------------------------------------------------------------------

describe('Antigravity', () => {
  it('writes to .agents/mcp_config.json when user picks "local" (1)', async () => {
    mockReadlineAnswers('1'); // Antigravity → local; no Claude follows

    await runMcpSetup({ yes: false });

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const writtenPath = String(vi.mocked(fs.writeFileSync).mock.calls[0]![0]);
    expect(writtenPath).toContain('.agents');
    const json = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string);
    expect(json.mcpServers.stem).toBeDefined();
  });

  it('writes to global mcp_config.json when user picks "global" (2)', async () => {
    mockReadlineAnswers('2'); // Antigravity → global

    await runMcpSetup({ yes: false });

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const writtenPath = String(vi.mocked(fs.writeFileSync).mock.calls[0]![0]);
    expect(writtenPath).toContain('.gemini');
    expect(writtenPath).toContain('mcp_config.json');
  });

  it('skips Antigravity when user picks "skip" (3)', async () => {
    mockReadlineAnswers('3'); // Antigravity → skip

    await runMcpSetup({ yes: false });

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('preserves existing mcpServers entries when patching', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).includes('.agents'));
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ mcpServers: { other: { command: 'other' } } }));
    mockReadlineAnswers('1');

    await runMcpSetup({ yes: false });

    const json = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string);
    expect(json.mcpServers.other).toBeDefined();
    expect(json.mcpServers.stem).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Claude Code CLI
// ---------------------------------------------------------------------------

describe('Claude Code CLI', () => {
  beforeEach(() => {
    // Make claude CLI available
    vi.mocked(child_process.execFileSync).mockImplementation((exe, args) => {
      if (exe === 'claude' && (args as string[])?.[0] === '--version') return Buffer.from('1.0');
      return Buffer.from('');
    });
  });

  it('adds with no --scope flag for "local" (1)', async () => {
    mockReadlineAnswers('3', '1'); // Antigravity → skip, Claude CLI → local

    await runMcpSetup({ yes: false });

    const claudeCall = vi.mocked(child_process.execFileSync).mock.calls.find(
      (c) => c[0] === 'claude' && (c[1] as string[])?.[0] === 'mcp',
    );
    expect(claudeCall![1]).not.toContain('--scope');
    expect(claudeCall![1]).toContain('stem');
  });

  it('adds with --scope project for "project" (2)', async () => {
    mockReadlineAnswers('3', '2'); // Antigravity → skip, Claude CLI → project

    await runMcpSetup({ yes: false });

    const claudeCall = vi.mocked(child_process.execFileSync).mock.calls.find(
      (c) => c[0] === 'claude' && (c[1] as string[])?.[0] === 'mcp',
    );
    expect(claudeCall![1]).toContain('--scope');
    expect(claudeCall![1]).toContain('project');
  });

  it('adds with --scope user for "global" (3)', async () => {
    mockReadlineAnswers('3', '3'); // Antigravity → skip, Claude CLI → global

    await runMcpSetup({ yes: false });

    const claudeCall = vi.mocked(child_process.execFileSync).mock.calls.find(
      (c) => c[0] === 'claude' && (c[1] as string[])?.[0] === 'mcp',
    );
    expect(claudeCall![1]).toContain('--scope');
    expect(claudeCall![1]).toContain('user');
  });

  it('skips Claude CLI when user picks "skip" (4)', async () => {
    mockReadlineAnswers('3', '4'); // Antigravity → skip, Claude CLI → skip

    await runMcpSetup({ yes: false });

    const claudeSetupCall = vi.mocked(child_process.execFileSync).mock.calls.find(
      (c) => c[0] === 'claude' && (c[1] as string[])?.[0] === 'mcp',
    );
    expect(claudeSetupCall).toBeUndefined();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Claude Desktop (global-only — auto-announce + Y/N confirm)
// ---------------------------------------------------------------------------

describe('Claude Desktop', () => {
  beforeEach(() => {
    // Claude CLI not present
    vi.mocked(child_process.execFileSync).mockImplementation(() => { throw new Error('not found'); });
    // Claude Desktop config exists
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes('claude_desktop_config.json'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
  });

  it('patches claude_desktop_config.json when user confirms (Y)', async () => {
    mockReadlineAnswers('3', 'y'); // Antigravity → skip, Desktop → Y

    await runMcpSetup({ yes: false });

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fs.writeFileSync).mock.calls[0]![0])).toContain('claude_desktop_config.json');
  });

  it('skips Claude Desktop when user declines (n)', async () => {
    mockReadlineAnswers('3', 'n'); // Antigravity → skip, Desktop → n

    await runMcpSetup({ yes: false });

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('auto-configures Desktop when --yes is set', async () => {
    await runMcpSetup({ yes: true });

    expect(readline.createInterface).not.toHaveBeenCalled();
    // --yes also writes Antigravity local; check that Desktop was one of the writes
    const desktopWrite = vi.mocked(fs.writeFileSync).mock.calls.find((c) =>
      String(c[0]).includes('claude_desktop_config.json'),
    );
    expect(desktopWrite).toBeDefined();
  });

  it('prints Linux message and skips Desktop on Linux', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('linux');
    // Antigravity prompt still runs first — supply a skip answer for it
    mockReadlineAnswers('3');

    await runMcpSetup({ yes: false });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Claude Desktop is not supported on Linux'),
    );
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
