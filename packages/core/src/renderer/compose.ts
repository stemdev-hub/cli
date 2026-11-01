import { createActivePath } from '../graph/traverser.js';
import type { BlockSyntax, Diagnostic, SourceLocation, SourceRange, SyntaxNode } from '../parser/syntax.js';
import type { AnalyzedSource, BlockReference, Definition, InstanceContext, ProjectAnalysis } from '../project/model.js';
import { definitionLocation, freezeOwned, issue } from '../project/model.js';
import { lookupBlockReference } from '../project/selection.js';

/** Evaluation-local selectors; adapters map their paths and references to these inputs. */
export type CompositionTarget =
  | { readonly kind: 'block'; readonly instance: InstanceContext; readonly reference: BlockReference }
  | { readonly kind: 'file'; readonly instance: InstanceContext; readonly sourceId: string };

/** Required nonnegative safe integers. Zero is a valid allowance, not a default. */
export interface CompositionLimits {
  readonly maxWork: number;
  readonly maxOutputBytes: number;
}

/** Shared adapter defaults; compose still requires an explicit limits argument. */
export const DEFAULT_COMPOSITION_LIMITS: CompositionLimits = Object.freeze({
  maxWork: 100_000,
  maxOutputBytes: 16 * 1024 * 1024
});

export interface CompositionResult {
  readonly content: string;
  /** All requested content was produced; definition errors may still prevent export. */
  readonly complete: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

interface Frame {
  readonly source: AnalyzedSource;
  readonly nodes: readonly SyntaxNode[];
  readonly start: number;
  readonly end: number;
  readonly block?: Definition;
  next: number;
}

/**
 * Compose supplied current sources without I/O, rescanning, formatting or cached output.
 * Each invocation owns its budgets and path.
 */
export function compose(analysis: ProjectAnalysis, target: CompositionTarget,
  limits: CompositionLimits): CompositionResult {
  if (!limits || !Number.isSafeInteger(limits.maxWork) || limits.maxWork < 0
    || !Number.isSafeInteger(limits.maxOutputBytes) || limits.maxOutputBytes < 0) {
    return freezeOwned({ content: '', complete: false, diagnostics: [issue('INVALID_COMPOSITION_LIMITS',
      'maxWork and maxOutputBytes must both be nonnegative safe integers.')] });
  }
  const diagnostics = new Set<Diagnostic>();
  const parts: string[] = [];
  const stack: Frame[] = [];
  const active = createActivePath<Definition>();
  const definitions = new Map<AnalyzedSource, Map<BlockSyntax, Definition>>();
  const contextual = new Map<InstanceContext, Map<Diagnostic, Diagnostic>>();
  let complete = true;
  let stopped = false;
  let work = 0;
  let bytes = 0;
  // A surrogate pair can straddle emitted fragments. Defer a trailing high surrogate
  // until the next emitted text (or EOF), so UTF-8 charges describe the final string.
  let pending: { value: string; location: SourceLocation } | undefined;

  const location = (source: AnalyzedSource, range: SourceRange): SourceLocation => ({
    sourceId: source.tree.source.sourceId, instance: source.instance.handle, range
  });
  const addSyntaxDiagnostics = (source: AnalyzedSource, node: SyntaxNode): void => {
    let owned = contextual.get(source.instance);
    if (!owned) { owned = new Map(); contextual.set(source.instance, owned); }
    for (const diagnostic of node.diagnostics) {
      let mapped = owned.get(diagnostic);
      if (!mapped) {
        const locate = (span: SourceLocation): SourceLocation => ({ ...span, instance: source.instance.handle });
        mapped = { ...diagnostic,
          ...(diagnostic.location ? { location: locate(diagnostic.location) } : {}),
          ...(diagnostic.related ? { related: diagnostic.related.map(locate) } : {}) };
        owned.set(diagnostic, mapped);
      }
      diagnostics.add(mapped);
    }
  };
  const exhaust = (code: 'COMPOSITION_WORK_LIMIT' | 'COMPOSITION_OUTPUT_LIMIT', at: SourceLocation): void => {
    diagnostics.add(issue(code, code === 'COMPOSITION_WORK_LIMIT'
      ? 'Composition exceeded maxWork.' : 'Composition exceeded maxOutputBytes.', at));
    complete = false;
    stopped = true;
  };
  const charge = (at: SourceLocation): boolean => {
    if (work === limits.maxWork) { exhaust('COMPOSITION_WORK_LIMIT', at); return false; }
    work++;
    return true;
  };
  const flushPending = (low = ''): boolean => {
    if (!pending) return true;
    const count = low ? 4 : 3;
    if (count > limits.maxOutputBytes - bytes) {
      exhaust('COMPOSITION_OUTPUT_LIMIT', pending.location);
      pending = undefined;
      return false;
    }
    bytes += count;
    parts.push(pending.value + low);
    pending = undefined;
    return true;
  };
  const emit = (value: string, start: number, end: number, at: SourceLocation): void => {
    if (start >= end) return;
    if (pending) {
      const first = value.charCodeAt(start);
      const low = first >= 0xdc00 && first <= 0xdfff ? value[start++]! : '';
      if (!flushPending(low)) return;
    }
    let cursor = start;
    while (cursor < end) {
      const first = value.charCodeAt(cursor);
      if (first >= 0xd800 && first <= 0xdbff && cursor + 1 === end) {
        if (limits.maxOutputBytes - bytes < 3) exhaust('COMPOSITION_OUTPUT_LIMIT', at);
        else pending = { value: value[cursor]!, location: at };
        break;
      }
      const second = value.charCodeAt(cursor + 1);
      const pair = first >= 0xd800 && first <= 0xdbff && second >= 0xdc00 && second <= 0xdfff;
      const count = pair ? 4 : first < 0x80 ? 1 : first < 0x800 ? 2 : 3;
      if (count > limits.maxOutputBytes - bytes) { exhaust('COMPOSITION_OUTPUT_LIMIT', at); break; }
      bytes += count;
      cursor += pair ? 2 : 1;
    }
    if (cursor > start) parts.push(value.slice(start, cursor));
  };
  const definitionFor = (source: AnalyzedSource, syntax: BlockSyntax): Definition => {
    let index = definitions.get(source);
    if (!index) {
      index = new Map(source.definitions.map(definition => [definition.syntax, definition]));
      definitions.set(source, index);
    }
    return index.get(syntax)!;
  };
  const enter = (definition: Definition, at: SourceLocation, parent?: Frame): void => {
    if (!charge(at)) return;
    const cycle = active.enter(definition);
    if (cycle) {
      diagnostics.add(issue('BLOCK_CYCLE', 'Composition re-enters an active Block instance.', at,
        cycle.map(definitionLocation)));
      complete = false;
      return;
    }
    const { source, syntax } = definition;
    addSyntaxDiagnostics(source, syntax);
    // Analysis also attaches graph/reference diagnostics here. Those are evaluated
    // at their actual composition occurrences, not imported from a graph-wide pass.
    for (const diagnostic of definition.diagnostics) {
      if (diagnostic.code === 'DUPLICATE_BLOCK_ID') diagnostics.add(diagnostic);
    }
    const content = source.tree.source.content;
    let start = syntax.header.range.endOffset;
    let end = syntax.ending.kind === 'marker' ? syntax.ending.range.startOffset : syntax.ending.offset;
    if (syntax.header.terminated) {
      if (content[start] === '\r') start += content[start + 1] === '\n' ? 2 : 1;
      else if (content[start] === '\n') start++;
    }
    if (syntax.ending.kind === 'marker') {
      if (content[end - 1] === '\n') end -= content[end - 2] === '\r' ? 2 : 1;
      else if (content[end - 1] === '\r') end--;
    }
    // Propagate ancestor boundary removal through implicit child endings. Inclusion
    // targets have independent source boundaries and deliberately receive no parent.
    start = Math.max(start, parent?.start ?? 0);
    end = Math.max(start, Math.min(end, parent?.end ?? content.length));
    stack.push({ source, nodes: syntax.children, start, end, block: definition, next: 0 });
    if (!syntax.header.terminated) {
      complete = false;
      emit(content, syntax.header.range.startOffset, syntax.header.range.endOffset,
        location(source, syntax.header.range));
    }
  };

  if (target.kind === 'block') {
    const resolution = lookupBlockReference(analysis, target.instance, target.reference);
    if (resolution.status === 'resolved') enter(resolution.target, definitionLocation(resolution.target));
    else { complete = false; for (const diagnostic of resolution.diagnostics) diagnostics.add(diagnostic); }
  } else if (!analysis.instances.includes(target.instance)) {
    complete = false;
    diagnostics.add(issue('UNAVAILABLE_INSTANCE', 'Instance does not belong to this analysis.'));
  } else if (!target.instance.available) {
    complete = false;
    diagnostics.add(issue('UNAVAILABLE_SOURCE', 'A complete, unambiguous source inventory is unavailable.'));
  } else {
    const sources = target.instance.sources.filter(source => source.tree.source.sourceId === target.sourceId);
    if (sources.length !== 1) {
      complete = false;
      diagnostics.add(issue('SOURCE_NOT_FOUND', `Source not found: ${target.sourceId}.`));
    } else {
      const source = sources[0]!;
      stack.push({ source, nodes: source.tree.children, start: 0, end: source.tree.source.content.length, next: 0 });
    }
  }
  while (stack.length > 0 && !stopped) {
    const frame = stack.at(-1)!;
    const node = frame.nodes[frame.next++];
    if (!node) {
      if (frame.block) active.leave();
      stack.pop();
      continue;
    }
    const at = location(frame.source, node.range);
    if (node.kind === 'block') {
      enter(definitionFor(frame.source, node), at, frame);
    } else if (node.kind === 'include') {
      if (!charge(at)) break;
      const resolution = lookupBlockReference(analysis, frame.source.instance, node.target, at);
      if (resolution.status === 'resolved') enter(resolution.target, at);
      else { complete = false; for (const diagnostic of resolution.diagnostics) diagnostics.add(diagnostic); }
    } else {
      addSyntaxDiagnostics(frame.source, node);
      if (node.kind === 'error') complete = false;
      // Only boundary line endings are clipped; scanner-decoded escapes elsewhere
      // stay untouched, and assembled text is never parsed again.
      const start = Math.max(0, frame.start - node.range.startOffset);
      const end = node.value.length - Math.max(0, node.range.endOffset - frame.end);
      emit(node.value, start, end, at);
    }
  }
  flushPending();
  return freezeOwned({ content: parts.join(''), complete, diagnostics: [...diagnostics] });
}
