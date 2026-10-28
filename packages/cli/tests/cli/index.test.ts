import { expect, it, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerCreateCommand } from '../../src/cli/commands/create.js';
import { registerListCommand } from '../../src/cli/commands/list.js';
import { registerRenderCommand } from '../../src/cli/commands/render.js';
import { reportPreview, reportQuery, reportRender } from '../../src/cli/output.js';
afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
});
it('registers explicit source/output commands without View aliases', () => {
  const p = new Command();
  registerCreateCommand(p);
  registerListCommand(p);
  registerRenderCommand(p);
  expect(p.commands.find((c) => c.name() === 'create')!.commands.map((c) => c.name())).toEqual([
    'block'
  ]);
  expect(p.commands.find((c) => c.name() === 'list')!.commands.map((c) => c.name())).toEqual([
    'blocks',
    'references',
    'outputs'
  ]);
  expect(p.commands.find((c) => c.name() === 'render')!.commands.map((c) => c.name())).toEqual([
    'all',
    'set',
    'block',
    'file'
  ]);
});
it('writes exact preview bytes and never emits ineligible stdout export', () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  reportPreview({ success: true, data: { content: ' A\r\nB ', complete: false, diagnostics: [] } });
  expect(stdout).toHaveBeenCalledExactlyOnceWith(' A\r\nB ');
  expect(process.exitCode).toBe(1);
  stdout.mockClear();
  reportPreview(
    { success: true, data: { content: 'partial', complete: false, diagnostics: [] } },
    true
  );
  expect(stdout).not.toHaveBeenCalled();
});
it('JSON retains query envelopes and incomplete classification fails', () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  const result = {
    success: true as const,
    data: { blocks: [], total: 0, classificationComplete: false, diagnostics: [] }
  };
  reportQuery(result, true);
  expect(stdout).toHaveBeenCalledWith(JSON.stringify(result) + '\n');
  expect(process.exitCode).toBe(1);
});
it('reports confirmed publication even on tracking/release failure', () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  reportRender({
    success: false,
    targets: [
      {
        root: 'out',
        outputSet: 'docs',
        path: 'a.md',
        status: 'published',
        tracking: 'failed',
        diagnostics: []
      }
    ],
    cleanup: [],
    errors: [
      { root: 'out', code: 'LOCK_RELEASE_FAILED', message: 'release failed', stage: 'release' }
    ]
  });
  expect(stdout).toHaveBeenCalledWith(
    expect.stringContaining('published docs:a.md (tracking failed)')
  );
  expect(stderr).toHaveBeenCalledWith(expect.stringContaining('release LOCK_RELEASE_FAILED'));
  expect(process.exitCode).toBe(1);
});
