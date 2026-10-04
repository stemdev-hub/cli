import type { BlockParameter, BlockRefSyntax } from './ast.js';
import type { Position } from './position.js';

export interface BlockRef {
  namespace: string | null;
  blockId: string;
  section: string | null;
  tag: string | null;
  parameters: readonly BlockParameter[];
  syntax: BlockRefSyntax;
  raw: string;
  position: Position;
}

export interface ParsedView {
  id: string;
  group: string | null;
  blockRefs: BlockRef[];
  filePath: string;
  relativePath: string;
  localContent: string;
  bodyStartLine: number;
}
