import type {
  AddRefResult,
  CheckResult,
  CreateBlockResult,
  CreateGroupResult,
  CreateViewResult,
  DeleteResult,
  InitResult,
  ListBlocksResult,
  ListViewsResult,
  OperationError,
  OperationResult,
  RenderResult,
  RenameResult,
  SyncResult,
  ValidationIssue,
  ValidationResult
} from '@stem/types';

type OperationFailure = { success: false; error: OperationError };

export function reportOperationError<T>(result: OperationResult<T>): result is OperationFailure {
  if (result.success) {
    return false;
  }

  console.error(result.error.message);
  if (isValidationResult(result.error.cause)) {
    for (const issue of result.error.cause.issues) {
      if (issue.severity === 'error') {
        console.error(formatValidationIssue(issue));
      }
    }
  }
  process.exitCode = 1;
  return true;
}

export function reportInit(result: OperationResult<InitResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  console.log(`Initialized Stem project at ${result.data.projectRoot}`);
}

export function reportCreateBlock(result: OperationResult<CreateBlockResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  console.log(`Created block ${result.data.id} at ${result.data.relativePath}`);
}

export function reportCreateView(result: OperationResult<CreateViewResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  console.log(`Created view ${result.data.id} at ${result.data.relativePath}`);
}

export function reportCreateGroup(result: OperationResult<CreateGroupResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  console.log(`Created group ${result.data.groupPath}`);
}

export function reportAdd(result: OperationResult<AddRefResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  console.log(`Added ${result.data.refString} to ${result.data.viewId}`);
}

export function reportDelete(result: OperationResult<DeleteResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  console.log(`Deleted ${result.data.id} from ${result.data.relativePath}`);
}

export function reportRename(result: OperationResult<RenameResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  console.log(`Renamed ${result.data.oldId} to ${result.data.newId}`);
  console.log(`Updated ${result.data.updatedRefCount} reference${result.data.updatedRefCount === 1 ? '' : 's'}`);
}

export function reportSync(result: OperationResult<SyncResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  console.log(
    `Synced ${result.data.scannedFiles} files (${result.data.parsedFiles} parsed, ${result.data.cachedFiles} cached)`
  );
  console.log(`Graph: ${result.data.graphNodes} nodes, ${result.data.graphEdges} edges`);
}

export function reportCheck(result: OperationResult<CheckResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  const { validation } = result.data;
  for (const issue of validation.issues) {
    console.log(formatValidationIssue(issue));
  }

  console.log(`${validation.errorCount} error${validation.errorCount === 1 ? '' : 's'}, ${validation.warningCount} warning${validation.warningCount === 1 ? '' : 's'}`);
  if (validation.hasErrors) {
    process.exitCode = 1;
  }
}

function formatValidationIssue(issue: ValidationIssue): string {
  return `${issue.severity.toUpperCase()} ${issue.code} ${issue.relativePath}: ${issue.message}`;
}

function isValidationResult(value: unknown): value is ValidationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Partial<ValidationResult>).issues)
  );
}

export function reportListBlocks(result: OperationResult<ListBlocksResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  for (const block of result.data.blocks) {
    const tags = block.tags.length === 0 ? '-' : block.tags.join(',');
    const usedIn = block.usedInViews.length === 0 ? '-' : block.usedInViews.join(',');
    console.log(`${block.id}\t${block.relativePath}\ttags:${tags}\tviews:${usedIn}`);
  }
  console.log(`${result.data.total} block${result.data.total === 1 ? '' : 's'}`);
}

export function reportListViews(result: OperationResult<ListViewsResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  for (const view of result.data.views) {
    const group = view.group ?? '-';
    const blocks = view.blockIds.length === 0 ? '-' : view.blockIds.join(',');
    console.log(`${view.id}\t${view.relativePath}\tgroup:${group}\tblocks:${blocks}`);
  }
  console.log(`${result.data.total} view${result.data.total === 1 ? '' : 's'}`);
}

export function reportRender(result: OperationResult<RenderResult>): void {
  if (reportOperationError(result)) {
    return;
  }

  const stdoutView = result.data.views.find((view) => view.markdown !== null);
  if (stdoutView?.markdown !== undefined && stdoutView.markdown !== null) {
    process.stdout.write(stdoutView.markdown);
    return;
  }

  for (const view of result.data.views) {
    console.log(`Rendered ${view.id} to ${view.outputRelativePath ?? '-'}`);
  }
  console.log(`${result.data.total} view${result.data.total === 1 ? '' : 's'} rendered`);
}
