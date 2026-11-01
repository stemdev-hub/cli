import type { BlockReference } from '../project/model.js';

export function isBlockId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value) && !/\s/.test(value);
}

/** Parse one exact inclusion target, without trimming or resolving it. */
export function parseBlockReference(value: string): BlockReference | undefined {
  const match = /^(?:([a-z0-9]+(?:-[a-z0-9]+)*):)?([A-Za-z0-9_-]+)$/.exec(value);
  if (!match || /\s/.test(value)) return undefined;
  return Object.freeze({
    id: match[2]!,
    ...(match[1] === undefined ? {} : { qualifier: match[1] })
  });
}

export function isTagName(value: string): boolean {
  return value.length > 0 && value.trim() === value && !/[\p{Cc}\u2028\u2029]/u.test(value);
}
