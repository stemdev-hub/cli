/** Private replacement declarations; public integration follows analysis and composition. */
export interface SourceDocument {
  readonly sourceId: string;
  readonly content: string;
}

/** UTF-16 offsets in the original source, with an exclusive end. */
export interface SourceRange {
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface SourceLocation {
  readonly sourceId: string;
  readonly range: SourceRange;
}

export interface Diagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly location?: SourceLocation;
  readonly related?: readonly SourceLocation[];
}

export interface TagToken {
  /** Decoded spelling, before NFC comparison during classification. */
  readonly value: string;
  readonly range: SourceRange;
}

/** Occurrences remain ordered, including unknown, repeated and malformed fields. */
export interface MetadataField {
  readonly range: SourceRange;
  readonly name?: string;
  readonly nameRange?: SourceRange;
  readonly valueRange?: SourceRange;
  readonly valid: boolean;
  readonly id?: string;
  readonly tags?: readonly TagToken[];
}

export interface BlockHeader {
  readonly range: SourceRange;
  readonly terminated: boolean;
  readonly fields: readonly MetadataField[];
}

export type BlockEnding =
  | { readonly kind: 'marker'; readonly range: SourceRange;
      readonly id?: string; readonly idRange?: SourceRange }
  | { readonly kind: 'ancestor' | 'eof'; readonly offset: number };

interface NodeBase {
  readonly range: SourceRange;
  /** Direct associations, not inferred later from overlapping source ranges. */
  readonly diagnostics: readonly Diagnostic[];
}

export interface BlockSyntax extends NodeBase {
  readonly kind: 'block';
  readonly header: BlockHeader;
  readonly children: readonly SyntaxNode[];
  readonly ending: BlockEnding;
}

export type SyntaxNode = BlockSyntax
  | (NodeBase & { readonly kind: 'text'; readonly value: string })
  | (NodeBase & { readonly kind: 'error'; readonly value: string })
  | (NodeBase & { readonly kind: 'include'; readonly target: {
      readonly qualifier?: string;
      readonly id: string;
      readonly idRange: SourceRange;
    } });

export interface SyntaxTree {
  readonly source: SourceDocument;
  readonly children: readonly SyntaxNode[];
}
