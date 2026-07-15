import type { Position } from './position.js';

export interface StemASTNode {
  type: string;
  data?: Record<string, unknown>;
  position?: Position;
}

export interface StemTagNode extends StemASTNode {
  type: 'stemTag';
  name: string;
  section: string | null;
  content: string;
}

export interface StemSectionNode extends StemASTNode {
  type: 'stemSection';
  name: string;
  prose: string;
}

export interface StemBlockRefNode extends StemASTNode {
  type: 'stemBlockRef';
  blockId: string;
  section: string | null;
  tag: string | null;
  raw: string;
}

export interface StemDepNode extends StemASTNode {
  type: 'stemDep';
  blockId: string;
  section: string | null;
  tag: string | null;
  raw: string;
}
