import type {
  StemASTNode,
  StemBlockRefNode,
  StemDepNode,
  StemSectionNode,
  StemTagNode
} from '@stem/types';

export interface StemEndNode extends StemASTNode {
  type: 'stemEnd';
  raw: string;
}

export type StemSyntaxNode =
  | StemTagNode
  | StemSectionNode
  | StemBlockRefNode
  | StemDepNode
  | StemEndNode;

export interface StemRoot extends StemASTNode {
  type: 'root';
  children: StemASTNode[];
}

// TODO: Provide a Remark plugin that emits typed AST nodes for @stem[...] syntax.
export function createStemRemarkPlugin(): () => void {
  return function stemRemarkPlugin(): void {
    return;
  };
}

// TODO: Collect Stem syntax nodes emitted by the parser plugin in document order.
export function collectStemNodes(_tree: StemRoot): StemSyntaxNode[] {
  return [];
}
