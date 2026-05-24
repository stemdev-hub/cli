import type { Position } from './position.js';

// TODO: Define cached and parsed block data contracts.
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
}

export interface StemSection extends Omit<CachedSection, 'tags' | 'externalTags'> {
  tags: StemTag[];
  externalTags: StemTag[];
  position: Position;
}

export interface ParsedBlock extends Omit<CachedBlock, 'sections' | 'standaloneTags'> {
  sections: StemSection[];
  standaloneTags: StemTag[];
  filePath: string;
  relativePath: string;
  rawContent: string;
}
