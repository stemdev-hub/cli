#!/usr/bin/env node
import { Command } from 'commander';
import { registerAddCommand } from './commands/add.js';
import { registerCheckCommand } from './commands/check.js';
import { registerCreateCommand } from './commands/create.js';
import { registerDeleteCommand } from './commands/delete.js';
import { registerInitCommand } from './commands/init.js';
import { registerListCommand } from './commands/list.js';
import { registerPreviewCommand } from './commands/preview.js';
import { registerRenameCommand } from './commands/rename.js';
import { registerRenderCommand } from './commands/render.js';
import { registerSyncCommand } from './commands/sync.js';
import { registerFetchNamespacesCommand } from './commands/fetch-namespaces.js';
import { registerPublishGraphCommand } from './commands/publish-graph.js';
import { registerMcpCommand } from './commands/mcp.js';

export function createStemProgram(): Command {
  const program = new Command();
  program.name('stem').description('Git-native documentation graphs for developers');
  registerInitCommand(program);
  registerCreateCommand(program);
  registerDeleteCommand(program);
  registerAddCommand(program);
  registerRenameCommand(program);
  registerRenderCommand(program);
  registerPreviewCommand(program);
  registerSyncCommand(program);
  registerCheckCommand(program);
  registerListCommand(program);
  registerFetchNamespacesCommand(program);
  registerPublishGraphCommand(program);
  registerMcpCommand(program);
  return program;
}

createStemProgram().parse();
