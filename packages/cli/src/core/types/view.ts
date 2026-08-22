import type { BlockParameter, BlockRefSyntax } from './ast.js';
import type { Position } from './position.js';

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

export interface BlockRef extends CachedBlockRef {
  position: Position;
}

export interface ParsedView extends Omit<CachedView, 'blockRefs'> {
  blockRefs: BlockRef[];
  filePath: string;
  relativePath: string;
  localContent: string;
  bodyStartLine: number;
}
