#!/usr/bin/env node
import { Command } from 'commander';
import { registerAddCommand } from './commands/add.js';
import { registerCheckCommand } from './commands/check.js';
import { registerCreateCommand } from './commands/create.js';
import { registerDeleteCommand } from './commands/delete.js';
import { registerInitCommand } from './commands/init.js';
import { registerListCommand } from './commands/list.js';
import { registerRenameCommand } from './commands/rename.js';
import { registerSyncCommand } from './commands/sync.js';

export function createStemProgram(): Command {
  const program = new Command();
  program.name('stem').description('Git-native documentation graphs for developers');
  registerInitCommand(program);
  registerCreateCommand(program);
  registerDeleteCommand(program);
  registerAddCommand(program);
  registerRenameCommand(program);
  registerSyncCommand(program);
  registerCheckCommand(program);
  registerListCommand(program);
  return program;
}

createStemProgram().parse();
