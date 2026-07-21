import type { OperationResult, PreviewResult, PreviewViewOptions } from '@stem/types';
import { renderView } from './render.js';

export async function previewView(
  viewId: string,
  options: PreviewViewOptions = {}
): Promise<OperationResult<PreviewResult>> {
  return renderView(viewId, { ...options, stdout: true });
}
