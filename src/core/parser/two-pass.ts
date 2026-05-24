import type {
  BlockRef,
  DependencyRef,
  StemSection,
  StemTag,
  ValidationIssue
} from '@stem/types';
import type { StemRoot } from './stem-plugin.js';

export interface TwoPassParseResult {
  sections: StemSection[];
  standaloneTags: StemTag[];
  blockRefs: BlockRef[];
  dependencies: DependencyRef[];
  errors: ValidationIssue[];
}

// TODO: Resolve section and tag relationships with a two-pass, non-throwing parse step.
export function runTwoPassParse(
  _tree: StemRoot,
  _filePath = '',
  _relativePath = ''
): TwoPassParseResult {
  return {
    sections: [],
    standaloneTags: [],
    blockRefs: [],
    dependencies: [],
    errors: []
  };
}
