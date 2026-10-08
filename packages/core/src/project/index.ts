import { buildGraph } from '../graph/builder.js';
import { detectCycles, getOrphanedBlocks } from '../graph/traverser.js';
import { parseBlockFile, parseViewFile } from '../parser/index.js';
import type { ParsedBlock } from '../types/block.js';
import type { ValidationIssue } from '../types/validation.js';
import type { ParsedView } from '../types/view.js';
import { validateGraph } from '../validator/rules.js';
import { validateSchemas } from '../validator/schema.js';
import type { AnalysisOptions, ProjectAnalysis, ProjectSnapshot } from './types.js';

export function analyzeProject(snapshot: ProjectSnapshot, options: AnalysisOptions): ProjectAnalysis {
  const blocks: ParsedBlock[] = [];
  const views: ParsedView[] = [];
  const parserIssues: ValidationIssue[] = [];

  for (const document of snapshot.blocks) {
    const { errors, ...block } = parseBlockFile(document);
    blocks.push(block);
    parserIssues.push(...errors);
  }

  for (const document of snapshot.views) {
    const { errors, ...view } = parseViewFile(document);
    views.push(view);
    parserIssues.push(...errors);
  }

  const { graph, issues: buildIssues } = buildGraph(blocks, views);
  const issues = [
    ...parserIssues,
    ...validateGraph({
      nowMs: options.nowMs,
      graph,
      blocks,
      views,
      buildIssues,
      schemas: snapshot.schemas,
      cycles: detectCycles(graph),
      orphanedBlocks: getOrphanedBlocks(graph),
      configuredNamespaces: snapshot.configuredNamespaces,
      externalGraphs: snapshot.externalGraphs,
      ...(options.strictExternal !== undefined ? { strictExternal: options.strictExternal } : {})
    }),
    ...validateSchemas(blocks, snapshot.schemas)
  ];
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    blocks,
    views,
    graph,
    validation: {
      issues,
      errorCount,
      warningCount,
      hasErrors: errorCount > 0,
      hasWarnings: warningCount > 0
    }
  };
}
