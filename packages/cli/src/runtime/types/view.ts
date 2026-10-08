import type { BlockParameter, BlockRefSyntax } from '@stemdev/core';

export interface CachedBlockRef {
  namespace: string | null;
  blockId: string;
  section: string | null;
  tag: string | null;
  parameters: readonly BlockParameter[];
  syntax: BlockRefSyntax;
  raw: string;
}

export interface CachedView {
  id: string;
  group: string | null;
  blockRefs: CachedBlockRef[];
}
