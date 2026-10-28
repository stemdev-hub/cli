import { isBlockId, isTagName, parseBlockReference } from '../parser/grammar.js';
import type { Diagnostic, SourceRange } from '../parser/syntax.js';
import type { AnalyzedSource, Definition, InclusionOccurrence, ProjectAnalysis } from './model.js';
import { freezeOwned, issue } from './model.js';
import { resolveBlockReference } from './selection.js';

export type EditDestination =
  | { readonly kind: 'file'; readonly sourceId: string }
  | { readonly kind: 'block'; readonly id: string };
export interface SourceEdit {
  readonly sourceId: string;
  readonly range: SourceRange;
  readonly replacement: string;
}
/** Evaluation-local preparation only; adapters recheck inputs and own publication. */
export type SourceEditPlan =
  | {
      readonly success: true;
      readonly edits: readonly SourceEdit[];
      readonly definitions: readonly Definition[];
      readonly references: readonly InclusionOccurrence[];
    }
  | { readonly success: false; readonly diagnostics: readonly Diagnostic[] };
const reject = (message: string): SourceEditPlan =>
  freezeOwned({ success: false, diagnostics: [issue('UNSAFE_SOURCE_EDIT', message)] });
const accept = (
  edits: SourceEdit[],
  definitions: readonly Definition[] = [],
  references: readonly InclusionOccurrence[] = []
): SourceEditPlan => freezeOwned({ success: true, edits, definitions, references });
function local(analysis: ProjectAnalysis, id: string): Definition | undefined {
  if (!isBlockId(id)) return undefined;
  const selected = resolveBlockReference(analysis, analysis.localInstance, { id });
  return selected.status === 'resolved' ? selected.target : undefined;
}
function bounded(definition: Definition): boolean {
  return definition.syntax.header.terminated && definition.syntax.ending.kind === 'marker';
}
function insertion(
  analysis: ProjectAnalysis,
  destination: EditDestination,
  text: string,
  createFile: boolean
): SourceEditPlan {
  if (!analysis.localInstance?.available) return reject('Local source inventory is unavailable.');
  let source: AnalyzedSource | undefined;
  let offset: number;
  if (destination.kind === 'block') {
    const parent = local(analysis, destination.id);
    if (!parent || !bounded(parent) || parent.children.some((child) => !bounded(child)))
      return reject('Parent has no unique, safe insertion boundary.');
    source = parent.source;
    if (parent.syntax.ending.kind !== 'marker') return reject('An actual closer is required.');
    offset = parent.syntax.ending.range.startOffset;
  } else {
    source = analysis.localInstance.sources.find(
      (item) => item.tree.source.sourceId === destination.sourceId
    );
    if (!source && !createFile) return reject('Source file is unavailable.');
    if (source?.definitions.some((definition) => !bounded(definition)))
      return reject('An open or recovered definition makes file insertion unsafe.');
    offset = source?.tree.source.content.length ?? 0;
  }
  const sourceId =
    source?.tree.source.sourceId ?? (destination.kind === 'file' ? destination.sourceId : '');
  const content = source?.tree.source.content ?? '';
  const ending = /\r\n|\r|\n/.exec(content)?.[0] ?? '\n';
  const before = offset > 0 && !/[\r\n]/.test(content[offset - 1]!) ? ending : '';
  return accept([
    {
      sourceId,
      range: { startOffset: offset, endOffset: offset },
      replacement: before + text.replaceAll('\n', ending) + ending
    }
  ]);
}

export function planCreateBlock(
  analysis: ProjectAnalysis,
  id: string,
  destination: EditDestination,
  tags: readonly string[] = []
): SourceEditPlan {
  if (!isBlockId(id) || tags.some((tag) => !isTagName(tag)))
    return reject('Invalid Block ID or Tag name.');
  if (
    analysis.localInstance?.sources.some((source) =>
      source.definitions.some((definition) => definition.id === id)
    )
  )
    return reject('Block ID already exists.');
  const unique = new Map<string, string>();
  for (const tag of tags)
    if (!unique.has(tag.normalize('NFC'))) unique.set(tag.normalize('NFC'), tag);
  const metadata = unique.size
    ? ` tags:[${[...unique.values()].map((tag) => JSON.stringify(tag)).join(', ')}]`
    : '';
  return insertion(
    analysis,
    destination,
    `@stem:block(id:${id}${metadata})\n@stem:end(id:${id})`,
    true
  );
}

export function planAddInclusion(
  analysis: ProjectAnalysis,
  reference: string,
  destination: EditDestination
): SourceEditPlan {
  const parsed = parseBlockReference(reference);
  if (
    !parsed ||
    resolveBlockReference(analysis, analysis.localInstance, parsed).status !== 'resolved'
  )
    return reject('Inclusion target is invalid, ambiguous or unavailable.');
  return insertion(analysis, destination, `@stem:include(${reference})`, false);
}

function subtree(root: Definition): Definition[] {
  const result: Definition[] = [];
  const pending = [root];
  while (pending.length) {
    const item = pending.pop()!;
    result.push(item);
    for (let index = item.children.length - 1; index >= 0; index--)
      pending.push(item.children[index]!);
  }
  return result;
}
function referencesKnown(analysis: ProjectAnalysis): boolean {
  return (
    analysis.localInstance?.available === true &&
    analysis.localInstance.sources.every(
      (source) =>
        source.referencesComplete &&
        source.definitions.every((definition) => definition.referencesComplete) &&
        source.inclusions.every((inclusion) => inclusion.resolution.status === 'resolved')
    )
  );
}
function referencesTo(
  analysis: ProjectAnalysis,
  definitions: ReadonlySet<Definition>
): InclusionOccurrence[] {
  return (analysis.localInstance?.sources ?? []).flatMap((source) =>
    source.inclusions.filter(
      (inclusion) =>
        inclusion.resolution.status === 'resolved' && definitions.has(inclusion.resolution.target)
    )
  );
}

export function planDeleteBlock(
  analysis: ProjectAnalysis,
  id: string,
  force = false
): SourceEditPlan {
  const definition = local(analysis, id);
  if (!definition || !bounded(definition) || !referencesKnown(analysis))
    return reject('Deletion requires a unique bounded Block and a complete reference assessment.');
  const definitions = subtree(definition);
  if (definitions.some((item) => !bounded(item)))
    return reject('Recovered ownership prevents deletion.');
  const removed = new Set(definitions);
  const references = referencesTo(analysis, removed).filter(
    (item) => !item.owner || !removed.has(item.owner)
  );
  if (references.length && !force)
    return reject('The Block or a descendant has surviving references.');
  return accept(
    [
      {
        sourceId: definition.source.tree.source.sourceId,
        range: definition.syntax.range,
        replacement: ''
      }
    ],
    definitions,
    references
  );
}

export function planRenameBlock(
  analysis: ProjectAnalysis,
  oldId: string,
  newId: string
): SourceEditPlan {
  const definition = local(analysis, oldId);
  if (!definition || !isBlockId(newId))
    return reject('Rename requires a unique local Block and a valid replacement ID.');
  if (oldId === newId) return accept([], [definition]);
  if (
    analysis.localInstance!.sources.some((source) =>
      source.definitions.some((item) => item.id === newId)
    )
  )
    return reject('Replacement ID already exists.');
  if (!bounded(definition) || !referencesKnown(analysis))
    return reject('Rename requires known boundaries and a complete reference assessment.');
  const idRange = definition.syntax.header.fields.find((field) => field.name === 'id')?.valueRange;
  if (!idRange) return reject('Definition ID token is unavailable.');
  const edits: SourceEdit[] = [
    { sourceId: definition.source.tree.source.sourceId, range: idRange, replacement: newId }
  ];
  const ending = definition.syntax.ending;
  if (ending.kind === 'marker' && ending.idRange)
    edits.push({
      sourceId: definition.source.tree.source.sourceId,
      range: ending.idRange,
      replacement: newId
    });
  const references = referencesTo(analysis, new Set([definition]));
  for (const item of references)
    edits.push({
      sourceId: item.source.tree.source.sourceId,
      range: item.syntax.target.idRange,
      replacement: newId
    });
  return accept(edits, [definition], references);
}
