import path from 'node:path';

import { analyzeProject } from '@stemdev/core';
import type { AnalysisOptions, ParsedBlock, ParsedView, ProjectSnapshot, SourceDocument, StemGraph, ValidationResult } from '@stemdev/core';
import type { DiscoveredFile, OperationResult, ProjectOperationOptions, ResolvedStemConfig } from '../types/index.js';
import { loadStemConfig } from '../config/index.js';
import { findBlockFiles, findProjectRoot, findViewFiles } from '../fs/finder.js';
import { readFile, toRelativePath } from '../fs/reader.js';
import { fromConfigError, fromFsError } from './errors.js';
import { loadSchemas } from './schemas.js';
import { loadExternalGraphs } from './external.js';

export interface LoadedProject {
  projectRoot: string;
  config: ResolvedStemConfig;
  blockFiles: DiscoveredFile[];
  viewFiles: DiscoveredFile[];
  snapshot: ProjectSnapshot;
  blocks: ParsedBlock[];
  views: ParsedView[];
  graph: StemGraph;
}

export async function loadProjectForCheck(
  options: ProjectOperationOptions = {}
): Promise<OperationResult<LoadedProject>> {
  const graphResult = await loadProjectGraph(options);
  if (!graphResult.success) {
    return graphResult;
  }

  const project = graphResult.data;
  const schemasResult = await loadSchemas(project.projectRoot, project.config);
  if (!schemasResult.success) {
    return schemasResult;
  }

  const externalGraphs = await loadExternalGraphs(project.config, options);

  return {
    success: true,
    data: {
      ...project,
      snapshot: { ...project.snapshot, schemas: schemasResult.data, externalGraphs }
    }
  };
}

export async function loadProjectGraph(
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
  const blocksResult = await readDiscoveredFiles(blockFiles);
  if (!blocksResult.success) {
    return blocksResult;
  }
  const viewsResult = await readDiscoveredFiles(viewFiles);
  if (!viewsResult.success) {
    return viewsResult;
  }

  const snapshot: ProjectSnapshot = {
    blocks: blocksResult.data,
    views: viewsResult.data,
    schemas: new Map(),
    configuredNamespaces: config.namespaces,
    externalGraphs: new Map()
  };
  const { blocks, views, graph } = analyzeProject(snapshot, { nowMs: Date.now() });

  return {
    success: true,
    data: { projectRoot, config, blockFiles, viewFiles, snapshot, blocks, views, graph }
  };
}

export function validateLoadedProject(
  project: LoadedProject,
  options: AnalysisOptions
): ValidationResult {
  return analyzeProject(project.snapshot, options).validation;
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

async function readDiscoveredFiles(files: DiscoveredFile[]): Promise<OperationResult<SourceDocument[]>> {
  const documents: SourceDocument[] = [];
  for (const file of files) {
    const readResult = await readFile(file.filePath);
    if (!readResult.success) {
      return { success: false, error: fromFsError(readResult.error) };
    }
    documents.push({ content: readResult.data, filePath: file.filePath, relativePath: file.relativePath });
  }
  return { success: true, data: documents };
}
