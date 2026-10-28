import { InvalidArgumentError } from 'commander';
import type { Command } from 'commander';
import { DEFAULT_COMPOSITION_LIMITS } from '@stemdev/core';
import type { CompositionLimits } from '@stemdev/core';
import { previewSource } from '../../runtime/operations/preview.js';
import { reportPreview } from '../output.js';
export function limit(value: string): number {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number))
    throw new InvalidArgumentError('Expected a nonnegative safe integer.');
  return number;
}
export function limitOptions(command: Command): Command {
  return command
    .option('--max-work <number>', 'Composition work allowance', limit)
    .option('--max-output-bytes <number>', 'UTF-8 output allowance', limit);
}
export function limits(options: Partial<CompositionLimits>): CompositionLimits {
  return {
    maxWork: options.maxWork ?? DEFAULT_COMPOSITION_LIMITS.maxWork,
    maxOutputBytes: options.maxOutputBytes ?? DEFAULT_COMPOSITION_LIMITS.maxOutputBytes
  };
}
export function registerPreviewCommand(program: Command): void {
  const preview = program.command('preview').description('Compose exact current source content');
  limitOptions(preview.command('block <ref>')).action(
    async (ref: string, options: Partial<CompositionLimits>) => {
      reportPreview(await previewSource({ kind: 'block', ref }, { limits: limits(options) }));
    }
  );
  limitOptions(preview.command('file <path>')).action(
    async (path: string, options: Partial<CompositionLimits>) => {
      reportPreview(await previewSource({ kind: 'file', path }, { limits: limits(options) }));
    }
  );
}
