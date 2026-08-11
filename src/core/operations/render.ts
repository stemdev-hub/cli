import path from 'node:path';

import matter from 'gray-matter';
import { dump } from 'js-yaml';

import type {
  OperationResult,
  ParsedView,
  RenderAllOptions,
  RenderResult,
  RenderViewOptions,
  RenderedViewResult
} from '@stem/types';
import { readFile, toRelativePath } from '../fs/reader.js';
import { writeFile } from '../fs/writer.js';
import { renderViewMarkdown } from '../renderer/index.js';
import { fromFsError, operationError } from './errors.js';
import { loadProjectForCheck, validateLoadedProject } from './project.js';

const DEFAULT_RENDER_OUT_DIR = 'rendered';

export async function renderView(
  viewId: string,
  options: RenderViewOptions = {}
): Promise<OperationResult<RenderResult>> {
  const projectResult = await loadRenderableProject(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const view = projectResult.data.views.find((candidate) => candidate.id === viewId);
  if (view === undefined) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `View "${viewId}" was not found.`)
    };
  }

  const renderedResult = await renderLoadedView(projectResult.data, view, options);
  if (!renderedResult.success) {
    return renderedResult;
  }

  return {
      success: true,
      data: {
        views: [renderedResult.data],
        total: 1,
        outDir: options.stdout === true ? null : getNormalizedOutDir(options.outDir)
      }
    };
}

export async function renderAll(options: RenderAllOptions = {}): Promise<OperationResult<RenderResult>> {
  const projectResult = await loadRenderableProject(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const renderedViews: RenderedViewResult[] = [];
  for (const view of projectResult.data.views) {
    const renderedResult = await renderLoadedView(projectResult.data, view, options);
    if (!renderedResult.success) {
      return renderedResult;
    }
    renderedViews.push(renderedResult.data);
  }

  return {
      success: true,
      data: {
        views: renderedViews,
        total: renderedViews.length,
        outDir: getNormalizedOutDir(options.outDir)
      }
    };
}

type LoadedRenderableProject = Awaited<ReturnType<typeof loadProjectForCheck>> extends OperationResult<infer T>
  ? T
  : never;

async function loadRenderableProject(
  options: RenderViewOptions | RenderAllOptions
): Promise<OperationResult<LoadedRenderableProject>> {
  const projectResult = await loadProjectForCheck(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const validation = validateLoadedProject(projectResult.data);
  if (validation.hasErrors) {
    return {
      success: false,
      error: operationError(
        'INVALID_OPERATION',
        `Cannot render project with ${validation.errorCount} validation error${validation.errorCount === 1 ? '' : 's'}. Run stem check for details.`,
        { cause: validation }
      )
    };
  }

  return projectResult;
}

async function renderLoadedView(
  project: LoadedRenderableProject,
  view: ParsedView,
  options: RenderViewOptions | RenderAllOptions
): Promise<OperationResult<RenderedViewResult>> {
  const renderResult = renderViewMarkdown(view, project.blocks);
  if (!renderResult.success) {
    return {
      success: false,
      error: operationError(
        'INVALID_OPERATION',
        `Cannot render view "${view.id}" with ${renderResult.validation.errorCount} validation error${renderResult.validation.errorCount === 1 ? '' : 's'}.`,
        { cause: renderResult.validation }
      )
    };
  }

  const body = renderResult.markdown;
  const markdownResult = await attachViewFrontmatter(view, body);
  if (!markdownResult.success) {
    return markdownResult;
  }

  if ('stdout' in options && options.stdout === true) {
    return {
      success: true,
      data: {
        id: view.id,
        relativePath: view.relativePath,
        outputPath: null,
        outputRelativePath: null,
        markdown: markdownResult.data
      }
    };
  }

  const outDirResult = normalizeOutDir(options.outDir);
  if (!outDirResult.success) {
    return outDirResult;
  }

  const outputPath = getRenderedOutputPath(project.projectRoot, project.config.viewsDir, outDirResult.data, view);
  const writeResult = await writeFile(outputPath, markdownResult.data, { overwrite: true });
  if (!writeResult.success) {
    return { success: false, error: fromFsError(writeResult.error) };
  }

  return {
    success: true,
    data: {
      id: view.id,
      relativePath: view.relativePath,
      outputPath,
      outputRelativePath: toRelativePath(outputPath, project.projectRoot),
      markdown: null
    }
  };
}

async function attachViewFrontmatter(view: ParsedView, renderedBody: string): Promise<OperationResult<string>> {
  const readResult = await readFile(view.filePath);
  if (!readResult.success) {
    return { success: false, error: fromFsError(readResult.error) };
  }

  try {
    const parsed = matter(readResult.data);
    return {
      success: true,
      data: `---\n${dump(parsed.data, { lineWidth: -1, noRefs: true })}---\n${renderedBody}${renderedBody.endsWith('\n') ? '' : '\n'}`
    };
  } catch (error) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', 'View frontmatter could not be parsed.', {
        path: view.filePath,
        cause: error
      })
    };
  }
}

function normalizeOutDir(value: string | undefined): OperationResult<string> {
  const raw = value?.trim() ?? DEFAULT_RENDER_OUT_DIR;
  const normalized = raw.replaceAll('\\', '/').replaceAll(/\/+/g, '/').replaceAll(/^\/|\/$/g, '');

  if (normalized.length === 0) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', 'Render output directory must not be empty.')
    };
  }

  if (path.isAbsolute(raw) || path.win32.isAbsolute(raw) || path.posix.isAbsolute(raw)) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Render output directory "${value ?? ''}" must be project-relative.`)
    };
  }

  if (normalized.split('/').includes('..')) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Render output directory "${value ?? ''}" must not contain "..".`)
    };
  }

  return { success: true, data: normalized };
}

function getNormalizedOutDir(value: string | undefined): string {
  const result = normalizeOutDir(value);
  return result.success ? result.data : DEFAULT_RENDER_OUT_DIR;
}

function getRenderedOutputPath(
  projectRoot: string,
  viewsDir: string,
  outDir: string,
  view: ParsedView
): string {
  const viewPathParts = view.relativePath.split('/');
  const viewsDirParts = viewsDir.split('/');
  const suffixParts = viewPathParts.slice(viewsDirParts.length);
  return path.join(projectRoot, ...outDir.split('/'), ...suffixParts);
}
