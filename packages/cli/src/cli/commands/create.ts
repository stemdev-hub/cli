import type { Command } from 'commander';
import { createBlock, createGroup, createView } from '../../core/operations/create.js';
import { reportCreateBlock, reportCreateGroup, reportCreateView } from '../output.js';

export function registerCreateCommand(program: Command): void {
  const create = program.command('create').description('Create Stem blocks, views, and groups');

  create
    .command('block <name>')
    .option('--tag <tag>')
    .action(async (name: string, options: { tag?: string }) => {
      reportCreateBlock(await createBlock(name, options.tag === undefined ? {} : { tag: options.tag }));
    });

  create
    .command('view <name>')
    .option('--group <group>')
    .action(async (name: string, options: { group?: string }) => {
      reportCreateView(await createView(name, options.group === undefined ? {} : { group: options.group }));
    });

  create.command('group <path>').action(async (groupPath: string) => {
    reportCreateGroup(await createGroup(groupPath));
  });
}
