import type { DependencyRef } from '@stemdev/core';

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
