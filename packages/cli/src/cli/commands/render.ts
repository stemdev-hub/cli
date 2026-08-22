import type { Command } from 'commander';
import { renderAll, renderView } from '../../core/operations/render.js';
import { reportRender } from '../output.js';

export function registerRenderCommand(program: Command): void {
  const render = program.command('render').description('Render Stem views to Markdown');
  render
    .command('view <viewId>')
    .option('--out <dir>')
    .option('--stdout')
    .action(async (viewId: string, options: { out?: string; stdout?: boolean }) => {
      reportRender(
        await renderView(viewId, {
          ...(options.out === undefined ? {} : { outDir: options.out }),
          ...(options.stdout === undefined ? {} : { stdout: options.stdout })
        })
      );
    });

  render
    .command('all')
    .option('--out <dir>')
    .action(async (options: { out?: string }) => {
      reportRender(await renderAll(options.out === undefined ? {} : { outDir: options.out }));
    });
}
