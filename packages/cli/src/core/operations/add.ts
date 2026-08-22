import type { AddRefOptions, AddRefResult, OperationResult, ParsedBlock } from '@stem/types';
import { readFile } from '../fs/reader.js';
import { writeFile } from '../fs/writer.js';
import { fromFsError, operationError } from './errors.js';
import { loadProjectGraph } from './project.js';

export async function addBlockToView(
  blockId: string,
  viewId: string,
  options: AddRefOptions = {}
): Promise<OperationResult<AddRefResult>> {
  const projectResult = await loadProjectGraph(options);
  if (!projectResult.success) {
    return projectResult;
  }

  const block = projectResult.data.blocks.find((candidate) => candidate.id === blockId);
  if (block === undefined) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Block "${blockId}" was not found.`)
    };
  }

  const view = projectResult.data.views.find((candidate) => candidate.id === viewId);
  if (view === undefined) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `View "${viewId}" was not found.`)
    };
  }

  const filtersResult = normalizeFilters(block, options);
  if (!filtersResult.success) {
    return filtersResult;
  }

  const refString = createRefString(blockId, filtersResult.data.section, filtersResult.data.tag);
  const readResult = await readFile(view.filePath);
  if (!readResult.success) {
    return { success: false, error: fromFsError(readResult.error) };
  }

  const writeResult = await writeFile(view.filePath, appendReference(readResult.data, refString), {
    overwrite: true
  });
  if (!writeResult.success) {
    return { success: false, error: fromFsError(writeResult.error) };
  }

  return {
    success: true,
    data: {
      blockId,
      viewId,
      viewFilePath: view.filePath,
      section: filtersResult.data.section,
      tag: filtersResult.data.tag,
      refString
    }
  };
}

interface NormalizedFilters {
  section: string | null;
  tag: string | null;
}

const STEM_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;

function normalizeFilters(
  block: ParsedBlock,
  options: AddRefOptions
): OperationResult<NormalizedFilters> {
  const sectionResult = normalizeOptionalIdentifier(options.section, 'Section');
  if (!sectionResult.success) {
    return sectionResult;
  }

  const tagResult = normalizeOptionalIdentifier(options.tag, 'Tag');
  if (!tagResult.success) {
    return tagResult;
  }

  const section = sectionResult.data;
  const tag = tagResult.data;

  if (tag !== null && section === null) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', 'A tag filter requires a section filter.')
    };
  }

  if (section !== null) {
    const foundSection = block.sections.find((candidate) => candidate.name === section);
    if (foundSection === undefined) {
      return {
        success: false,
        error: operationError('INVALID_OPERATION', `Block "${block.id}" has no section "${section}".`)
      };
    }

    if (tag !== null && !hasTag(foundSection, tag)) {
      return {
        success: false,
        error: operationError(
          'INVALID_OPERATION',
          `Section "${section}" in block "${block.id}" has no tag "${tag}".`
        )
      };
    }
  }

  return { success: true, data: { section, tag } };
}

function normalizeOptionalIdentifier(
  value: string | undefined,
  label: 'Section' | 'Tag'
): OperationResult<string | null> {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return { success: true, data: null };
  }

  if (!STEM_IDENTIFIER_PATTERN.test(trimmed)) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `${label} "${trimmed}" is not a valid Stem identifier.`)
    };
  }

  return { success: true, data: trimmed };
}

function hasTag(section: ParsedBlock['sections'][number], tagName: string): boolean {
  return [...section.tags, ...section.externalTags].some((tag) => tag.name === tagName);
}

function createRefString(blockId: string, section: string | null, tag: string | null): string {
  const sectionParam = section === null ? '' : ` section=${section}`;
  const tagParam = tag === null ? '' : ` tag=${tag}`;

  return `@stem[block:${blockId}${sectionParam}${tagParam}]`;
}

function appendReference(content: string, refString: string): string {
  if (content.length === 0) {
    return `${refString}\n`;
  }

  const separator = content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${separator}${refString}\n`;
}
