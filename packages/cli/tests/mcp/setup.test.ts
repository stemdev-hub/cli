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

describe('MCP Setup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(os, 'platform').mockReturnValue('win32');
    vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\Test');
  });

  it('configures Antigravity when config exists and user confirms', async () => {
    vi.mocked(child_process.execFileSync).mockImplementation(() => { throw new Error('no claude'); });
    
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => String(p).includes('mcp_config.json'));
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ mcpServers: { other: {} } }));

    const mockQuestion = vi.fn((query, cb) => cb('y'));
    vi.mocked(readline.createInterface).mockReturnValue({
      question: mockQuestion,
      close: vi.fn(),
    } as any);

    await runMcpSetup();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const writeArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(String(writeArgs![0])).toContain('mcp_config.json');
    const writtenJson = JSON.parse(writeArgs![1] as string);
    expect(writtenJson.mcpServers.stem).toBeDefined();
    expect(writtenJson.mcpServers.other).toBeDefined();
  });

  it('runs claude CLI when available and user confirms', async () => {
    vi.mocked(child_process.execFileSync).mockImplementation((exe: string, args?: readonly string[]) => {
      if (exe === 'claude' && args?.[0] === '--version') return Buffer.from('1.0.0');
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false); // No Antigravity

    const mockQuestion = vi.fn((query, cb) => cb('y'));
    vi.mocked(readline.createInterface).mockReturnValue({
      question: mockQuestion,
      close: vi.fn(),
    } as any);

    await runMcpSetup();

    expect(child_process.execFileSync).toHaveBeenCalledWith('claude', ['mcp', 'add', 'stem', '--', 'stem', 'mcp'], { stdio: 'inherit' });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('falls back to JSON editing for Claude Desktop when CLI is missing', async () => {
    vi.mocked(child_process.execFileSync).mockImplementation(() => { throw new Error('no claude'); });
    
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => String(p).includes('claude_desktop_config.json'));
    vi.mocked(fs.readFileSync).mockReturnValue('{}');

    const mockQuestion = vi.fn((query, cb) => cb('y'));
    vi.mocked(readline.createInterface).mockReturnValue({
      question: mockQuestion,
      close: vi.fn(),
    } as any);

    await runMcpSetup();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fs.writeFileSync).mock.calls[0]![0])).toContain('claude_desktop_config.json');
  });

  it('aborts without writing when user says no', async () => {
    vi.mocked(child_process.execFileSync).mockImplementation(() => { throw new Error('no claude'); });
    vi.mocked(fs.existsSync).mockReturnValue(true); // Both exist
    
    const mockQuestion = vi.fn((query, cb) => cb('n'));
    vi.mocked(readline.createInterface).mockReturnValue({
      question: mockQuestion,
      close: vi.fn(),
    } as any);

    await runMcpSetup();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('shows error message on Linux for Claude Desktop', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('linux');
    vi.mocked(child_process.execFileSync).mockImplementation(() => { throw new Error('no claude'); });
    
    // Antigravity does not exist, so we only test Claude fallback
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await runMcpSetup();
    expect(console.log).toHaveBeenCalledWith('Claude Desktop is not supported on Linux. Install the Claude CLI and try again.');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('configures both Antigravity and Claude CLI sequentially when both exist', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => String(p).includes('mcp_config.json'));
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    
    vi.mocked(child_process.execFileSync).mockImplementation((exe: string, args?: readonly string[]) => {
      if (exe === 'claude' && args?.[0] === '--version') return Buffer.from('1.0.0');
      return Buffer.from('');
    });

    const mockQuestion = vi.fn((query, cb) => cb('y'));
    vi.mocked(readline.createInterface).mockReturnValue({
      question: mockQuestion,
      close: vi.fn(),
    } as any);

    await runMcpSetup();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fs.writeFileSync).mock.calls[0]![0])).toContain('mcp_config.json');
    
    expect(child_process.execFileSync).toHaveBeenCalledWith('claude', ['mcp', 'add', 'stem', '--', 'stem', 'mcp'], { stdio: 'inherit' });
  });
});
