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

export interface CachedTag {
  name: string;
  section: string | null;
  content: string;
}

export interface CachedSection {
  name: string;
  tags: CachedTag[];
  externalTags: CachedTag[];
  prose: string;
}

export interface CachedBlock {
  id: string;
  tags: string[];
  dependsOn: DependencyRef[];
  sections: CachedSection[];
  standaloneTags: CachedTag[];
}

export interface StemTag extends CachedTag {
  position: Position;
  contentRange: SourceRange;
}

export interface StemSection extends Omit<CachedSection, 'tags' | 'externalTags'> {
  tags: StemTag[];
  externalTags: StemTag[];
  position: Position;
  proseRange: SourceRange;
}

export interface ParsedBlock extends Omit<CachedBlock, 'sections' | 'standaloneTags'> {
  sections: StemSection[];
  standaloneTags: StemTag[];
  filePath: string;
  relativePath: string;
  rawContent: string;
  bodyStartLine: number;
}
