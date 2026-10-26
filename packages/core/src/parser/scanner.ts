import type {
  BlockEnding, BlockHeader, Diagnostic, MetadataField, SourceDocument,
  SourceLocation, SourceRange, SyntaxNode, SyntaxTree, TagToken
} from './syntax.js';

const PREFIX = '@stem:';
const OPEN = '@stem:block(';
const ID = /^[A-Za-z0-9_-]+$/;
const TARGET = /^(?:([a-z0-9]+(?:-[a-z0-9]+)*):)?([A-Za-z0-9_-]+)$/;
const space = (character: string | undefined): boolean => character === ' ' || character === '\t';
const newline = (character: string | undefined): boolean => character === '\r' || character === '\n';
const range = (startOffset: number, endOffset: number): SourceRange => ({ startOffset, endOffset });

interface Frame {
  readonly start: number;
  readonly header: BlockHeader;
  readonly children: SyntaxNode[];
  readonly diagnostics: Diagnostic[];
  readonly id: string | undefined;
  readonly depth: number;
}

/** Freeze iteratively: nesting depth must not become JavaScript call-stack depth. */
function freezeRecords(value: object): void {
  const pending: object[] = [value];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const record = pending.pop()!;
    if (seen.has(record)) continue;
    seen.add(record);
    for (const child of Object.values(record) as unknown[]) {
      if (child !== null && typeof child === 'object') pending.push(child);
    }
    Object.freeze(record);
  }
}

/** Parse supplied source only. This module is deliberately not a package export yet. */
export function parse(source: SourceDocument): {
  readonly tree: SyntaxTree;
  readonly diagnostics: readonly Diagnostic[];
} {
  // Copy the record so callers cannot change this evaluation through an input alias.
  const document = { sourceId: source.sourceId, content: source.content };
  const content = document.content;
  const diagnostics: Diagnostic[] = [];
  const roots: SyntaxNode[] = [];
  const stack: Frame[] = [];
  // Open-frame lookup avoids repeatedly walking deep ancestry for labelled closers.
  const openIds = new Map<string, Frame[]>();
  let cursor = 0;
  let textStart = 0;
  let textParts: string[] = [];
  let literalStart = 0;

  const children = (): SyntaxNode[] => stack.at(-1)?.children ?? roots;
  const location = (span: SourceRange): SourceLocation => ({ sourceId: document.sourceId, range: span });
  const report = (owned: Diagnostic[], code: string, message: string, span: SourceRange,
    severity: 'error' | 'warning' = 'error', related?: SourceRange): void => {
    const diagnostic: Diagnostic = {
      code, severity, message, location: location(span),
      ...(related === undefined ? {} : { related: [location(related)] })
    };
    owned.push(diagnostic);
    diagnostics.push(diagnostic);
  };
  const flushText = (end: number): void => {
    if (end > textStart) {
      textParts.push(content.slice(literalStart, end));
      children().push({ kind: 'text', range: range(textStart, end), value: textParts.join(''), diagnostics: [] });
    }
    textParts = [];
  };
  const resumeText = (at: number): void => { textStart = at; literalStart = at; cursor = at; };

  // A failed instruction consumes its first ')' but leaves a subsequent active marker or newline.
  const failedEnd = (start: number): number => {
    let at = start + PREFIX.length;
    let slashes = 0;
    while (at < content.length && !newline(content[at])) {
      if (content[at] === ')') return at + 1;
      if (content.startsWith(PREFIX, at) && slashes % 2 === 0) return at;
      slashes = content[at] === '\\' ? slashes + 1 : 0;
      at++;
    }
    return at;
  };

  const tagList = (start: number, end: number, owned: Diagnostic[]): { tags: TagToken[]; valid: boolean } => {
    const tags: TagToken[] = [];
    let valid = true;
    const invalid = (message: string, from: number, to: number): void => {
      valid = false;
      report(owned, 'INVALID_TAG_LIST', message, range(from, to));
    };
    if (content[start] !== '[') {
      invalid('Tags require a bracketed list.', start, end);
      return { tags, valid };
    }
    const terminated = content[end - 1] === ']';
    const limit = terminated ? end - 1 : end;
    if (!terminated) invalid('Tag list is missing its closing bracket.', start, end);
    let entry = start + 1;
    let quoted = false;
    let escaped = false;
    const names = new Map<string, SourceRange>();
    const accept = (stop: number, emptyList: boolean): void => {
      let from = entry;
      let to = stop;
      while (space(content[from]) && from < to) from++;
      while (to > from && space(content[to - 1])) to--;
      if (from === to) {
        if (!emptyList) invalid('Tag entries must not be empty.', from, to);
        return;
      }
      const raw = content.slice(from, to);
      let value: string;
      if (raw.startsWith('"')) {
        try {
          const decoded: unknown = JSON.parse(raw);
          if (typeof decoded !== 'string') throw new Error('Not a string');
          value = decoded;
        } catch {
          invalid('A quoted Tag must be one complete JSON string.', from, to);
          return;
        }
      } else {
        if (/[[\]"\\]/.test(raw)) {
          invalid('Quote the whole Tag name to use brackets, quotes or backslashes.', from, to);
          return;
        }
        value = raw;
      }
      if (value.length === 0 || /[\p{Cc}\u2028\u2029]/u.test(value)
        || (raw.startsWith('"') && value.trim() !== value)) {
        invalid('Tag names must be nonempty, without controls, line breaks or quoted edge whitespace.', from, to);
        return;
      }
      const span = range(from, to);
      tags.push({ value, range: span });
      const normalized = value.normalize('NFC');
      const previous = names.get(normalized);
      if (previous) report(owned, 'DUPLICATE_TAG', 'Duplicate Tag name; classification attaches it once.', span, 'warning', previous);
      else names.set(normalized, span);
    };
    for (let at = entry; at < limit; at++) {
      const character = content[at];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === ',') { accept(at, false); entry = at + 1; }
    }
    accept(limit, entry === start + 1);
    return { tags, valid };
  };

  const header = (start: number, owned: Diagnostic[]): BlockHeader => {
    const fields: MetadataField[] = [];
    let at = start + OPEN.length;
    let list = false;
    let quoted = false;
    let escaped = false;
    // Header scanning is line-bounded even for an unfinished JSON string.
    while (at < content.length && !newline(content[at])) {
      const character = content[at];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === '[') list = true;
      else if (character === ']') list = false;
      else if (character === ')' && !list) break;
      at++;
    }
    const limit = at;
    const terminated = content[at] === ')' && !quoted && !list;
    const span = range(start, at + (terminated ? 1 : 0));
    if (!terminated) report(owned, 'UNFINISHED_BLOCK_HEADER', 'Block header must end on its opening line.', span);
    at = start + OPEN.length;
    const seen = new Map<string, SourceRange>();
    while (at < limit) {
      const beforeSpace = at;
      while (space(content[at]) && at < limit) at++;
      if (at === limit) break;
      if (fields.length > 0 && at === beforeSpace && !space(content[at - 1])) {
        report(owned, 'INVALID_BLOCK_METADATA', 'Metadata fields require a space or tab separator.', range(at, at));
      }
      const fieldStart = at;
      while (at < limit && /[A-Za-z0-9_-]/.test(content[at]!)) at++;
      const nameEnd = at;
      const name = content.slice(fieldStart, nameEnd);
      if (!name || content[at] !== ':') {
        while (at < limit && !space(content[at])) at++;
        const fieldRange = range(fieldStart, at);
        fields.push({ range: fieldRange, valid: false,
          ...(name ? { name, nameRange: range(fieldStart, nameEnd) } : {}) });
        report(owned, 'INVALID_BLOCK_METADATA', 'Expected a metadata field with an adjacent colon.', fieldRange);
        continue;
      }
      at++;
      while (space(content[at]) && at < limit) at++;
      const valueStart = at;
      // A recognizable next field is not a value for a missing field.
      const nextField = /^[A-Za-z0-9_-]+:/.test(content.slice(at, limit));
      if (!nextField) {
        let inList = false;
        let inQuote = false;
        let escape = false;
        while (at < limit) {
          const character = content[at];
          if (inQuote) {
            if (escape) escape = false;
            else if (character === '\\') escape = true;
            else if (character === '"') inQuote = false;
          } else if (character === '"') inQuote = true;
          else if (character === '[') inList = true;
          else if (character === ']') { at++; break; }
          else if (space(character) && !inList) break;
          at++;
        }
      }
      const fieldRange = range(fieldStart, at);
      const valueRange = range(valueStart, at);
      const raw = content.slice(valueStart, at);
      let valid = true;
      let id: string | undefined;
      let tags: TagToken[] | undefined;
      if (name === 'id') {
        if (ID.test(raw)) id = raw;
        else { valid = false; report(owned, 'INVALID_BLOCK_ID', 'Block ID must contain only ASCII letters, digits, hyphens or underscores.', valueRange); }
      } else if (name === 'tags') {
        const parsed = tagList(valueStart, at, owned);
        valid = parsed.valid;
        tags = parsed.tags;
      } else {
        valid = false;
        report(owned, 'UNKNOWN_BLOCK_FIELD', `Unknown Block metadata field: ${name}.`, range(fieldStart, nameEnd));
      }
      const previous = seen.get(name);
      if (previous) report(owned, 'REPEATED_BLOCK_FIELD', `Repeated Block metadata field: ${name}.`, fieldRange, 'error', previous);
      else seen.set(name, fieldRange);
      fields.push({ range: fieldRange, name, nameRange: range(fieldStart, nameEnd),
        ...(at > valueStart ? { valueRange } : {}), valid,
        ...(id === undefined ? {} : { id }), ...(tags === undefined ? {} : { tags }) });
    }
    if (!seen.has('id')) report(owned, 'MISSING_BLOCK_ID', 'Block header requires one id field.', span);
    return { range: span, terminated, fields };
  };

  const close = (ending: BlockEnding, end: number): void => {
    const frame = stack.pop()!;
    if (frame.id !== undefined) {
      const matching = openIds.get(frame.id)!;
      matching.pop();
      if (matching.length === 0) openIds.delete(frame.id);
    }
    if (ending.kind !== 'marker') {
      report(frame.diagnostics, 'MISSING_BLOCK_END', 'Block has no matching closing marker.', frame.header.range,
        'error', range(end, end));
    }
    children().push({ kind: 'block', range: range(frame.start, end), header: frame.header,
      children: frame.children, ending, diagnostics: frame.diagnostics });
  };

  while (cursor < content.length) {
    if (content[cursor] === '\\') {
      const start = cursor;
      while (content[cursor] === '\\') cursor++;
      if (content.startsWith(PREFIX, cursor)) {
        const count = cursor - start;
        textParts.push(content.slice(literalStart, start), '\\'.repeat(Math.floor(count / 2)));
        literalStart = cursor;
        if (count % 2 !== 0) { cursor += PREFIX.length; continue; }
      } else continue;
    }
    if (!content.startsWith(PREFIX, cursor)) { cursor++; continue; }
    flushText(cursor);
    const start = cursor;
    const owned: Diagnostic[] = [];
    if (content.startsWith(OPEN, start)) {
      const parsed = header(start, owned);
      const ids = parsed.fields.filter(field => field.name === 'id');
      const id = ids.length === 1 && ids[0]!.valid ? ids[0]!.id : undefined;
      const frame: Frame = { start, header: parsed, children: [], diagnostics: owned, id, depth: stack.length };
      stack.push(frame);
      if (id !== undefined) {
        const matching = openIds.get(id);
        if (matching) matching.push(frame);
        else openIds.set(id, [frame]);
      }
      // The header range itself is the visible recovery fragment when unfinished;
      // do not duplicate it as a child. Its following newline remains content.
      resumeText(parsed.range.endOffset);
      continue;
    }
    const end = failedEnd(start);
    const fragment = content.slice(start, end);
    if (content.startsWith('@stem:include(', start) && fragment.endsWith(')')) {
      const argumentsStart = start + '@stem:include('.length;
      const raw = content.slice(argumentsStart, end - 1);
      const value = raw.replace(/^[ \t]+|[ \t]+$/g, '');
      const match = TARGET.exec(value);
      if (match) {
        const id = match[2]!;
        const valueStart = argumentsStart + raw.length - raw.trimStart().length;
        const idStart = valueStart + (match[1] === undefined ? 0 : match[1].length + 1);
        children().push({ kind: 'include', range: range(start, end), diagnostics: [], target: {
          id, idRange: range(idStart, idStart + id.length),
          ...(match[1] === undefined ? {} : { qualifier: match[1] })
        } });
        resumeText(end);
        continue;
      }
    } else if (content.startsWith('@stem:end(', start) && fragment.endsWith(')')) {
      const argumentsStart = start + '@stem:end('.length;
      const raw = content.slice(argumentsStart, end - 1);
      const match = /^[ \t]*(?:id:[ \t]*([A-Za-z0-9_-]+))?[ \t]*$/.exec(raw);
      if (match) {
        const id = match[1];
        const inner = stack.at(-1);
        const candidates = id === undefined ? undefined : openIds.get(id);
        const target = id === undefined || inner?.id === id ? inner
          : candidates?.length === 1 ? candidates[0] : undefined;
        if (target) {
          while (stack.length - 1 > target.depth) close({ kind: 'ancestor', offset: start }, start);
          const idStart = id === undefined ? undefined : argumentsStart + raw.indexOf(':') + 1
            + (raw.slice(raw.indexOf(':') + 1).length - raw.slice(raw.indexOf(':') + 1).trimStart().length);
          close({ kind: 'marker', range: range(start, end),
            ...(id === undefined || idStart === undefined ? {} : { id, idRange: range(idStart, idStart + id.length) }) }, end);
          resumeText(end);
          continue;
        }
        report(owned, 'UNMATCHED_BLOCK_END', 'Closing marker does not identify an open Block unambiguously.', range(start, end));
      }
    }
    if (owned.length === 0) report(owned, 'INVALID_STEM_INSTRUCTION', 'Malformed or unknown Stem instruction.', range(start, end));
    children().push({ kind: 'error', range: range(start, end), value: fragment, diagnostics: owned });
    resumeText(end);
  }
  flushText(content.length);
  while (stack.length > 0) close({ kind: 'eof', offset: content.length }, content.length);
  const result = { tree: { source: document, children: roots }, diagnostics };
  freezeRecords(result);
  return result;
}
