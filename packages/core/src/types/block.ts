import type { Position } from './position.js';

export interface SourceRange {
  startOffset: number;
  endOffset: number;
}

export interface DependencyRef {
  blockId: string;
  section: string | null;
  tag: string | null;
  raw: string;
}

export interface StemTag {
  name: string;
  section: string | null;
  content: string;
  position: Position;
  contentRange: SourceRange;
}

export interface StemSection {
  name: string;
  tags: StemTag[];
  externalTags: StemTag[];
  prose: string;
  position: Position;
  proseRange: SourceRange;
}

export interface ParsedBlock {
  id: string;
  tags: string[];
  dependsOn: DependencyRef[];
  sections: StemSection[];
  standaloneTags: StemTag[];
  filePath: string;
  relativePath: string;
  rawContent: string;
  bodyStartLine: number;
}
