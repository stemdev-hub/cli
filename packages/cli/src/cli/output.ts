import type { Diagnostic } from '@stemdev/core';
import type {
  MutationResult,
  OperationResult,
  PreviewResult,
  RenderResult
} from '../runtime/types/index.js';
import type { CleanupResult } from '../runtime/output/cleanup.js';
export function reportDiagnostics(diagnostics: readonly Diagnostic[]): void {
  for (const d of diagnostics)
    process.stderr.write(
      d.severity +
        ' ' +
        d.code +
        ': ' +
        d.message +
        (d.location ? ' (' + d.location.sourceId + ':' + d.location.range.startOffset + ')' : '') +
        '\n'
    );
}
export function reportQuery<T>(result: OperationResult<T>, json = false): void {
  if (json) process.stdout.write(JSON.stringify(result) + '\n');
  if (!result.success) {
    if (!json) process.stderr.write(result.error.code + ': ' + result.error.message + '\n');
    process.exitCode = 1;
    return;
  }
  const data = result.data as {
    diagnostics?: readonly Diagnostic[];
    complete?: boolean;
    classificationComplete?: boolean;
  };
  if (!json) {
    process.stdout.write(JSON.stringify(result.data, null, 2) + '\n');
  }
  if (
    data.diagnostics?.some((d) => d.severity === 'error') ||
    data.complete === false ||
    data.classificationComplete === false
  )
    process.exitCode = 1;
}
export const reportInit = reportQuery;
export const reportCheck = reportQuery;
export const reportSync = reportQuery;
export function reportMutation(result: MutationResult): void {
  for (const file of result.changedFiles) process.stdout.write('Changed ' + file + '\n');
  reportDiagnostics(result.diagnostics);
  if (!result.success) {
    process.stderr.write(
      (result.stage ?? 'preparation') + ': ' + (result.error?.message ?? 'Mutation failed.') + '\n'
    );
    process.exitCode = 1;
  }
}
export const reportRename = reportMutation;
export function reportPreview(result: OperationResult<PreviewResult>, exportOnly = false): void {
  if (!result.success) {
    process.stderr.write(result.error.code + ': ' + result.error.message + '\n');
    process.exitCode = 1;
    return;
  }
  const eligible =
    result.data.complete && !result.data.diagnostics.some((d) => d.severity === 'error');
  if (!exportOnly || eligible) process.stdout.write(result.data.content);
  reportDiagnostics(result.data.diagnostics);
  if (!eligible) process.exitCode = 1;
}
export function reportRender(result: RenderResult): void {
  for (const target of result.targets) {
    process.stdout.write(
      target.status +
        ' ' +
        target.outputSet +
        ':' +
        target.path +
        ' (tracking ' +
        target.tracking +
        ')' +
        (target.reason ? ': ' + target.reason : '') +
        '\n'
    );
    reportDiagnostics(target.diagnostics);
  }
  for (const action of result.cleanup)
    process.stdout.write(
      action.action +
        ' ' +
        (action.path ?? action.outputSet) +
        (action.reason ? ': ' + action.reason : '') +
        '\n'
    );
  for (const error of result.errors)
    process.stderr.write(error.stage + ' ' + error.code + ': ' + error.message + '\n');
  if (!result.success) process.exitCode = 1;
}
export function reportCleanup(result: CleanupResult): void {
  for (const action of result.outcomes)
    process.stdout.write(
      action.action +
        ' ' +
        (action.path ?? action.outputSet) +
        (action.reason ? ': ' + action.reason : '') +
        '\n'
    );
  for (const error of result.errors)
    process.stderr.write(error.stage + ' ' + error.code + ': ' + error.message + '\n');
  if (!result.success) process.exitCode = 1;
}
