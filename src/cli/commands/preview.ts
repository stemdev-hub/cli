import type { Command } from 'commander';
import { previewView } from '../../core/operations/preview.js';
import { reportRender } from '../output.js';

export function registerPreviewCommand(program: Command): void {
  const preview = program.command('preview').description('Preview a rendered Stem view in the terminal');
  preview
    .command('view <viewId>')
    .action(async (viewId: string) => {
      reportRender(await previewView(viewId));
    });
}
