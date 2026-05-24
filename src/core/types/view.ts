import type { Position } from './position.js';

// TODO: Define cached and parsed view file contracts.
export interface CachedBlockRef {
  blockId: string;
  section: string | null;
  tag: string | null;
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
}
