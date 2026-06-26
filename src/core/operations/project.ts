import path from 'node:path';

import type {
  DiscoveredFile,
  OperationResult,
  ParsedBlock,
  ParsedView,
  ProjectOperationOptions,
  ResolvedStemConfig,
  StemGraph,
  TagSchema,
  ValidationIssue,
  ValidationResult
} from '@stem/types';
import { loadStemConfig } from '../config/index.js';
import { findBlockFiles, findProjectRoot, findViewFiles } from '../fs/finder.js';
import { readFile, toRelativePath } from '../fs/reader.js';
import { buildGraph } from '../graph/builder.js';
import type { GraphBuildIssue } from '../graph/types.js';
import { detectCycles, getOrphanedBlocks } from '../graph/traverser.js';
import { parseBlockFile, parseViewFile } from '../parser/index.js';
import { validateGraph } from '../validator/rules.js';
import { validateSchemas } from '../validator/schema.js';
import { fromConfigError, fromFsError } from './errors.js';
import { loadSchemas } from './schemas.js';

export interface LoadedProject {
  projectRoot: string;
  config: ResolvedStemConfig;
  blockFiles: DiscoveredFile[];
  viewFiles: DiscoveredFile[];
  blocks: ParsedBlock[];
  views: ParsedView[];
  parserIssues: ValidationIssue[];
  graph: StemGraph;
  graphBuildIssues: GraphBuildIssue[];
  cycles: string[][];
  orphanedBlocks: string[];
  schemas: Map<string, TagSchema>;
}

export async function loadProjectForCheck(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<LoadedProject>> {
  const startDir = options.startDir ?? process.cwd();
  const projectRootResult = await findProjectRoot(startDir);
  if (!projectRootResult.success) {
    return { success: false, error: fromFsError(projectRootResult.error) };
  }

  const projectRoot = projectRootResult.data;
  const configResult = await loadStemConfig(projectRoot);
  if (!configResult.success) {
    return { success: false, error: fromConfigError(configResult.error) };
  }

  const config = configResult.data;
  const blockFilesResult = await findBlockFiles(projectRoot, config);
  if (!blockFilesResult.success) {
    return { success: false, error: fromFsError(blockFilesResult.error) };
  }

  const viewFilesResult = await findViewFiles(projectRoot, config);
  if (!viewFilesResult.success) {
    return { success: false, error: fromFsError(viewFilesResult.error) };
  }

  const blockFiles = toDiscoveredFiles(blockFilesResult.data, projectRoot, 'block');
  const viewFiles = toDiscoveredFiles(viewFilesResult.data, projectRoot, 'view');
  const parseResult = await parseDiscoveredFiles(blockFiles, viewFiles);
  if (!parseResult.success) {
    return parseResult;
  }

  const graphResult = buildGraph(parseResult.data.blocks, parseResult.data.views);
  const cycles = detectCycles(graphResult.graph);
  const orphanedBlocks = getOrphanedBlocks(graphResult.graph);
  const schemasResult = await loadSchemas(projectRoot, config);
  if (!schemasResult.success) {
    return schemasResult;
  }

  return {
    success: true,
    data: {
      projectRoot,
      config,
      blockFiles,
      viewFiles,
      blocks: parseResult.data.blocks,
      views: parseResult.data.views,
      parserIssues: parseResult.data.parserIssues,
      graph: graphResult.graph,
      graphBuildIssues: graphResult.issues,
      cycles,
      orphanedBlocks,
      schemas: schemasResult.data
    }
  };
}

export function validateLoadedProject(project: LoadedProject): ValidationResult {
  const issues = [
    ...project.parserIssues,
    ...validateGraph({
      graph: project.graph,
      blocks: project.blocks,
      views: project.views,
      buildIssues: project.graphBuildIssues,
      schemas: project.schemas,
      cycles: project.cycles,
      orphanedBlocks: project.orphanedBlocks
    }),
    ...validateSchemas(project.blocks, project.schemas)
  ];

  return toValidationResult(issues);
}

function toDiscoveredFiles(
  filePaths: string[],
  projectRoot: string,
  type: DiscoveredFile['type']
): DiscoveredFile[] {
  return filePaths.map((filePath) => ({
    filePath: path.resolve(filePath),
    relativePath: toRelativePath(filePath, projectRoot),
    type
  }));
}

async function parseDiscoveredFiles(
  blockFiles: DiscoveredFile[],
  viewFiles: DiscoveredFile[]
): Promise<OperationResult<{ blocks: ParsedBlock[]; views: ParsedView[]; parserIssues: ValidationIssue[] }>> {
  const blocks: ParsedBlock[] = [];
  const views: ParsedView[] = [];
  const parserIssues: ValidationIssue[] = [];

  for (const file of blockFiles) {
    const readResult = await readFile(file.filePath);
    if (!readResult.success) {
      return { success: false, error: fromFsError(readResult.error) };
    }

    const { errors, ...block } = parseBlockFile({
      content: readResult.data,
      filePath: file.filePath,
      relativePath: file.relativePath
    });

    blocks.push(block);
    parserIssues.push(...errors);
  }

  for (const file of viewFiles) {
    const readResult = await readFile(file.filePath);
    if (!readResult.success) {
      return { success: false, error: fromFsError(readResult.error) };
    }

    const { errors, ...view } = parseViewFile({
      content: readResult.data,
      filePath: file.filePath,
      relativePath: file.relativePath
    });

    views.push(view);
    parserIssues.push(...errors);
  }

  return { success: true, data: { blocks, views, parserIssues } };
}

function toValidationResult(issues: ValidationIssue[]): ValidationResult {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    issues,
    errorCount,
    warningCount,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0
  };
}
