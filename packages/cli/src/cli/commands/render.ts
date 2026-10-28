import type { Command } from 'commander';
import type { CompositionLimits } from '@stemdev/core';
import { renderOutputs } from '../../runtime/operations/render.js';
import { previewSource } from '../../runtime/operations/preview.js';
import { reportPreview, reportRender } from '../output.js';
import { limitOptions, limits } from './preview.js';
export function registerRenderCommand(program: Command): void {
  const render = program.command('render').description('Export eligible composition');
  limitOptions(render.command('all')).action(async (options: Partial<CompositionLimits>) => {
    reportRender(await renderOutputs({ kind: 'all' }, { limits: limits(options) }));
  });
  limitOptions(
    render
      .command('set <name>')
      .option(
        '--target <path>',
        'Configured destination; repeat for several',
        (value: string, previous: string[] = []) => [...previous, value]
      )
  ).action(async (name: string, options: Partial<CompositionLimits> & { target?: string[] }) => {
    reportRender(
      await renderOutputs(
        {
          kind: 'sets',
          sets: [{ name, ...(options.target === undefined ? {} : { targets: options.target }) }]
        },
        { limits: limits(options) }
      )
    );
  });
  limitOptions(render.command('block <ref>').requiredOption('--stdout')).action(
    async (ref: string, options: Partial<CompositionLimits>) => {
      reportPreview(await previewSource({ kind: 'block', ref }, { limits: limits(options) }), true);
    }
  );
  limitOptions(render.command('file <path>').requiredOption('--stdout')).action(
    async (path: string, options: Partial<CompositionLimits>) => {
      reportPreview(await previewSource({ kind: 'file', path }, { limits: limits(options) }), true);
    }
  );
}
