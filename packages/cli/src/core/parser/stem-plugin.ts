import { SKIP, visit } from 'unist-util-visit';
import type {
  BlockParameter,
  BlockRefSyntax,
  Position,
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

export interface StemInvalidNode extends StemASTNode {
  type: 'stemInvalid';
  raw: string;
  reason: string;
}

export type StemSyntaxNode =
  | StemTagNode
  | StemSectionNode
  | StemBlockRefNode
  | StemDepNode
  | StemEndNode
  | StemInvalidNode;

export interface StemTextNode extends StemASTNode {
  type: 'text';
  value: string;
}

export interface StemParentNode extends StemASTNode {
  children: StemMdastNode[];
}

export type StemMdastNode = StemTextNode | StemSyntaxNode | StemParentNode | StemASTNode;

export interface StemRoot extends StemParentNode {
  type: 'root';
  data?: Record<string, unknown>;
}

interface StemMacro {
  node: StemSyntaxNode;
  startIndex: number;
  endIndex: number;
}

interface StemParameterMap {
  section: string | null;
  tag: string | null;
}

interface ParsedArguments {
  section: string | null;
  tag: string | null;
  parameters: BlockParameter[];
  syntax: BlockRefSyntax;
  reason: string | null;
}

interface ArgumentToken {
  name: string;
  value: string;
  quoted: boolean;
}

const STEM_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;
const STEM_ARGUMENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const STEM_SCOPED_DEP_PATTERN = /^[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)?$/;
const DANGEROUS_PARAMETER_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

// Transform only mdast text nodes; code, inlineCode, and raw html remain untouched.
export function createStemRemarkPlugin(): (tree: StemRoot) => void {
  return function transformer(tree: StemRoot): void {
    visit(tree, 'text', (node: StemTextNode, index, parent) => {
      if (
        index === undefined ||
        parent === undefined ||
        !('children' in parent) ||
        !Array.isArray(parent.children)
      ) {
        return;
      }

      const replacement = replaceTextNode(node);
      if (replacement === null) {
        return;
      }

      parent.children.splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
}

export function parseStemMacro(raw: string, position?: Position): StemSyntaxNode | null {
  if (!raw.startsWith('@stem[') || !raw.endsWith(']') || raw.includes('\n') || raw.includes('\r')) {
    return null;
  }

  const inner = raw.slice(6, -1);
  if (inner === 'end') {
    return withOptionalPosition<StemEndNode>({ type: 'stemEnd', raw }, position);
  }

  const separatorIndex = inner.indexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  const type = inner.slice(0, separatorIndex);
  const rest = inner.slice(separatorIndex + 1);
  if (type !== 'block' && type !== 'section' && type !== 'tag' && type !== 'dep') {
    return null;
  }

  if (type === 'dep') {
    const scopedIdentifier = rest.trim();
    const { argumentSource } = splitIdentifierAndArguments(rest);
    if (argumentSource.trim().length > 0 || !STEM_SCOPED_DEP_PATTERN.test(rest.trim())) {
      return invalid(raw, 'Dependency references do not accept arguments.', position);
    }
    if (scopedIdentifier.includes(':')) {
      return invalid(raw, 'Dependency references cannot target external namespaces.', position);
    }
    return createDepNode(scopedIdentifier, raw, position);
  }

  const { identifier, argumentSource } = splitIdentifierAndArguments(rest);
  let blockNamespace: string | null = null;
  let targetIdentifier = identifier;

  if (type === 'block') {
    const colonIndex = identifier.indexOf(':');
    if (colonIndex > 0) {
      blockNamespace = identifier.slice(0, colonIndex);
      targetIdentifier = identifier.slice(colonIndex + 1);
    }
  }

  if (!isValidIdentifier(targetIdentifier)) {
    return invalid(raw, `Invalid ${type} identifier.`, position);
  }

  const args = parseArguments(argumentSource);
  if (args.reason !== null) {
    return invalid(raw, args.reason, position);
  }

  if (type === 'block') {
    return createBlockRefNode(blockNamespace, targetIdentifier, args, raw, position);
  }

  if (type === 'section') {
    if (args.parameters.length > 0 || args.section !== null || args.tag !== null) {
      return invalid(raw, 'Section macros do not accept arguments.', position);
    }
    return createSectionNode(identifier, position);
  }

  return createTagNode(identifier, args, position);
}

export function collectStemNodes(tree: StemRoot): StemSyntaxNode[] {
  const nodes: StemSyntaxNode[] = [];
  visit(tree, (node) => {
    if (isStemSyntaxNode(node)) {
      nodes.push(node);
    }
  });
  return nodes;
}

export function isDangerousParameterName(name: string): boolean {
  return DANGEROUS_PARAMETER_NAMES.has(name);
}

function createBlockRefNode(
  namespace: string | null,
  blockId: string,
  params: ParsedArguments,
  raw: string,
  position: Position | undefined
): StemBlockRefNode {
  return withOptionalPosition<StemBlockRefNode>(
    {
      type: 'stemBlockRef',
      namespace,
      blockId,
      section: params.section,
      tag: params.tag,
      parameters: params.parameters,
      syntax: params.syntax,
      raw
    },
    position
  );
}

function createSectionNode(name: string, position: Position | undefined): StemSectionNode {
  return withOptionalPosition<StemSectionNode>(
    { type: 'stemSection', name, prose: '' },
    position
  );
}

function createTagNode(
  name: string,
  params: StemParameterMap,
  position: Position | undefined
): StemTagNode {
  return withOptionalPosition<StemTagNode>(
    { type: 'stemTag', name, section: params.section, content: '' },
    position
  );
}

function createDepNode(
  identifier: string,
  raw: string,
  position: Position | undefined
): StemDepNode {
  const scoped = parseScopedIdentifier(identifier);
  return withOptionalPosition<StemDepNode>(
    {
      type: 'stemDep',
      blockId: scoped.blockId,
      section: scoped.section,
      tag: scoped.tag,
      raw
    },
    position
  );
}

function invalid(raw: string, reason: string, position: Position | undefined): StemInvalidNode {
  return withOptionalPosition<StemInvalidNode>({ type: 'stemInvalid', raw, reason }, position);
}

function replaceTextNode(node: StemTextNode): StemMdastNode[] | null {
  const macros = findMacros(node);
  if (macros.length === 0) {
    return null;
  }

  const replacement: StemMdastNode[] = [];
  let cursor = 0;
  for (const macro of macros) {
    if (macro.startIndex > cursor) {
      replacement.push(createTextSlice(node, cursor, macro.startIndex));
    }
    replacement.push(macro.node);
    cursor = macro.endIndex;
  }

  if (cursor < node.value.length) {
    replacement.push(createTextSlice(node, cursor, node.value.length));
  }
  return replacement;
}

function findMacros(node: StemTextNode): StemMacro[] {
  const macros: StemMacro[] = [];
  let searchFrom = 0;

  while (searchFrom < node.value.length) {
    const startIndex = node.value.indexOf('@stem[', searchFrom);
    if (startIndex < 0) {
      break;
    }

    const endIndex = findMacroEnd(node.value, startIndex);
    if (endIndex === null) {
      searchFrom = startIndex + 6;
      continue;
    }

    const raw = node.value.slice(startIndex, endIndex + 1);
    const parsed = parseStemMacro(raw, slicePosition(node, startIndex, endIndex + 1));
    if (parsed !== null) {
      macros.push({ node: parsed, startIndex, endIndex: endIndex + 1 });
    }
    searchFrom = endIndex + 1;
  }

  return macros;
}

function findMacroEnd(value: string, startIndex: number): number | null {
  let cursor = startIndex + 6;
  let inQuote = false;

  while (cursor < value.length) {
    const character = value[cursor];
    if (character === '\n' || character === '\r') {
      return null;
    }

    if (inQuote) {
      if (character === '\\') {
        cursor += 2;
        continue;
      }
      if (character === '"') {
        inQuote = false;
      }
      cursor += 1;
      continue;
    }

    if (character === '"') {
      inQuote = true;
    } else if (character === ']') {
      return cursor;
    }
    cursor += 1;
  }

  return null;
}

function splitIdentifierAndArguments(input: string): { identifier: string; argumentSource: string } {
  const trimmedStart = input.trimStart();
  const leadingWhitespace = input.length - trimmedStart.length;
  const firstSeparator = trimmedStart.search(/[ \t,]/);
  if (firstSeparator < 0) {
    return { identifier: trimmedStart, argumentSource: '' };
  }

  return {
    identifier: trimmedStart.slice(0, firstSeparator),
    argumentSource: input.slice(leadingWhitespace + firstSeparator)
  };
}

function parseArguments(source: string): ParsedArguments {
  const result: ParsedArguments = {
    section: null,
    tag: null,
    parameters: [],
    syntax: 'legacy',
    reason: null
  };
  const seen = new Set<string>();
  let cursor = 0;
  let sawComma = false;

  while (cursor < source.length) {
    const separator = readSeparators(source, cursor);
    cursor = separator.cursor;
    sawComma ||= separator.sawComma;

    if (cursor >= source.length) {
      break;
    }

    const token = readArgument(source, cursor);
    if (token.reason !== null) {
      return { ...result, reason: token.reason };
    }
    cursor = token.cursor;

    const arg = token.argument;
    if (!STEM_ARGUMENT_NAME_PATTERN.test(arg.name)) {
      return { ...result, reason: `Invalid argument name "${arg.name}".` };
    }
    if (isDangerousParameterName(arg.name)) {
      return { ...result, reason: `Argument name "${arg.name}" is reserved.` };
    }
    if (seen.has(arg.name)) {
      return { ...result, reason: `Duplicate argument "${arg.name}".` };
    }
    seen.add(arg.name);

    if (arg.quoted) {
      result.syntax = 'extended';
    }

    if (arg.name === 'section') {
      result.section = normalizeToken(arg.value);
    } else if (arg.name === 'tag') {
      result.tag = normalizeToken(arg.value);
    } else {
      result.parameters.push({ name: arg.name, value: arg.value });
      result.syntax = 'extended';
    }
  }

  if (sawComma) {
    result.syntax = 'extended';
  }

  return result;
}

function readSeparators(source: string, start: number): { cursor: number; sawComma: boolean } {
  let cursor = start;
  let sawComma = false;
  while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t' || source[cursor] === ',')) {
    if (source[cursor] === ',') {
      sawComma = true;
    }
    cursor += 1;
  }
  return { cursor, sawComma };
}

function readArgument(
  source: string,
  start: number
): { argument: ArgumentToken; cursor: number; reason: null } | { argument?: never; cursor: number; reason: string } {
  let cursor = start;
  while (cursor < source.length && !/[=\s,]/.test(source[cursor] ?? '')) {
    cursor += 1;
  }

  const name = source.slice(start, cursor);
  if (name.length === 0) {
    return { cursor, reason: 'Expected argument name.' };
  }

  while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t')) {
    cursor += 1;
  }

  if (source[cursor] !== '=') {
    return { cursor, reason: `Expected "=" after argument "${name}".` };
  }
  cursor += 1;

  while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t')) {
    cursor += 1;
  }

  if (source[cursor] === '"') {
    return readQuotedArgument(source, cursor + 1, name);
  }

  const valueStart = cursor;
  while (cursor < source.length && source[cursor] !== ',' && source[cursor] !== ' ' && source[cursor] !== '\t') {
    cursor += 1;
  }

  if (cursor === valueStart) {
    return { cursor, reason: `Expected value for argument "${name}".` };
  }

  return {
    argument: { name, value: source.slice(valueStart, cursor), quoted: false },
    cursor,
    reason: null
  };
}

function readQuotedArgument(
  source: string,
  start: number,
  name: string
): { argument: ArgumentToken; cursor: number; reason: null } | { argument?: never; cursor: number; reason: string } {
  let cursor = start;
  let value = '';
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '"') {
      return {
        argument: { name, value, quoted: true },
        cursor: cursor + 1,
        reason: null
      };
    }
    if (character === '\\') {
      const next = source[cursor + 1];
      if (next === undefined) {
        return { cursor, reason: `Unterminated escape in argument "${name}".` };
      }
      value += next;
      cursor += 2;
      continue;
    }
    value += character;
    cursor += 1;
  }

  return { cursor, reason: `Unterminated quoted value for argument "${name}".` };
}

function createTextSlice(node: StemTextNode, startIndex: number, endIndex: number): StemTextNode {
  return withOptionalPosition<StemTextNode>(
    { type: 'text', value: node.value.slice(startIndex, endIndex) },
    slicePosition(node, startIndex, endIndex)
  );
}

function slicePosition(
  node: StemTextNode,
  startIndex: number,
  endIndex: number
): Position | undefined {
  if (node.position === undefined) {
    return undefined;
  }
  return {
    start: pointAt(node.position.start, node.value, startIndex),
    end: pointAt(node.position.start, node.value, endIndex)
  };
}

function pointAt(start: Position['start'], value: string, index: number): Position['start'] {
  let line = start.line;
  let column = start.column;
  for (let offset = 0; offset < index; offset += 1) {
    if (value[offset] === '\n') {
      line += 1;
      column = 1;
    } else if (!isTrailingSurrogate(value.charCodeAt(offset))) {
      column += 1;
    }
  }

  const point: Position['start'] = { line, column };
  if (start.offset !== undefined) {
    point.offset = start.offset + index;
  }
  return point;
}

function parseScopedIdentifier(identifier: string): StemParameterMap & { blockId: string } {
  const [blockId = '', scope] = identifier.split('#', 2);
  const [section, tag] = scope?.split('.', 2) ?? [];
  return { blockId, section: normalizeToken(section), tag: normalizeToken(tag) };
}

function normalizeToken(value: string | undefined): string | null {
  return value !== undefined && value.trim().length > 0 ? value.trim() : null;
}

function isValidIdentifier(identifier: string): boolean {
  return STEM_IDENTIFIER_PATTERN.test(identifier);
}

function isStemSyntaxNode(node: { type: string }): node is StemSyntaxNode {
  return (
    node.type === 'stemTag' ||
    node.type === 'stemSection' ||
    node.type === 'stemBlockRef' ||
    node.type === 'stemDep' ||
    node.type === 'stemEnd' ||
    node.type === 'stemInvalid'
  );
}

function isTrailingSurrogate(charCode: number): boolean {
  return charCode >= 0xdc00 && charCode <= 0xdfff;
}

function withOptionalPosition<T extends StemASTNode>(node: T, position: Position | undefined): T {
  if (position !== undefined) {
    node.position = position;
  }
  return node;
}
