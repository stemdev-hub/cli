import type { ConfigError, ConfigErrorCode } from './portable.js';

/** Explicit adapter-facing selectors; neither spelling nor Tags imply a selector kind. */
export type OutputSource =
  | { readonly kind: 'block'; readonly ref: string }
  | { readonly kind: 'file'; readonly path: string };

export interface OutputTarget {
  readonly source: OutputSource;
  /** Canonical slash-separated file path relative to this set's output directory. */
  readonly path: string;
}

export interface OutputSet {
  /** Original spelling; the adapter resolves this against the configuring project. */
  readonly outputDir: string;
  readonly ifExists: 'replace' | 'skip' | 'error';
  readonly cleanup: 'keep' | 'prune';
  readonly targets: readonly OutputTarget[];
}

/** Own set names only, including names such as __proto__; no inherited dictionary entries. */
export type OutputSets = Readonly<Record<string, OutputSet>>;

type Result<T> = { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: Readonly<ConfigError> };
const record = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};

function invalid<T>(field: string, reason: string, configPath: string,
  code: ConfigErrorCode = 'CONFIG_INVALID_SCHEMA'): Result<T> {
  return Object.freeze({ success: false, error: Object.freeze({ code, path: configPath,
    message: `Stem config field ${JSON.stringify(field)} ${reason}.` }) });
}

function fields(value: Record<string, unknown>, allowed: readonly string[], prefix: string,
  configPath: string): Result<undefined> {
  const unknown = Object.keys(value).find(key => !allowed.includes(key));
  return unknown === undefined ? { success: true, data: undefined }
    : invalid(`${prefix}.${unknown}`, 'is unknown', configPath);
}

/** Normalize portable relative spellings, never resolve parent traversal or infer filenames. */
function relativePath(value: unknown, field: string, configPath: string, directory = false): Result<string> {
  if (typeof value !== 'string') return invalid(field, 'must be a string', configPath);
  const path = value.replaceAll('\\', '/');
  const segments = path.split('/');
  if (path.length === 0 || path.includes('\0') || path.startsWith('/')
    || /^[a-z][a-z\d+.-]*:/i.test(path) || segments.includes('..')) {
    return invalid(field, 'must be a nonempty project/root-relative path without NUL or parent traversal',
      configPath, 'CONFIG_INVALID_PATH');
  }
  if (!directory && (segments.at(-1) === '' || segments.at(-1) === '.')) {
    return invalid(field, 'must name a file, not a directory', configPath, 'CONFIG_INVALID_PATH');
  }
  const normalized = segments.filter(segment => segment !== '' && segment !== '.').join('/');
  if (normalized.length === 0) return invalid(field, 'must not select the path root', configPath, 'CONFIG_INVALID_PATH');
  if (/^[a-z][a-z\d+.-]*:/i.test(normalized)) {
    return invalid(field, 'must remain relative after normalization', configPath, 'CONFIG_INVALID_PATH');
  }
  return { success: true, data: normalized };
}

function outputDirectory(value: unknown, field: string, configPath: string): Result<string> {
  if (value === undefined) return { success: true, data: '.' };
  if (typeof value !== 'string') return invalid(field, 'must be a string', configPath);
  const drive = /^[a-z]:/i.test(value);
  if (value.length === 0 || value.includes('\0') || (drive && !/^[a-z]:[\\/]/i.test(value))
    || (!drive && /^[a-z][a-z\d+.-]*:/i.test(value))) {
    return invalid(field, 'must be a nonempty directory path, not a URL or drive-relative path', configPath, 'CONFIG_INVALID_PATH');
  }
  // Host compatibility, fully qualified native roots, physical containment and
  // protected destinations require adapter validation. Do not normalize across symlinks.
  return { success: true, data: value };
}

function sourceSelector(raw: unknown, directory: string, prefix: string, configPath: string): Result<OutputSource> {
  if (!record(raw)) return invalid(prefix, 'must be an object', configPath);
  if (raw['kind'] !== 'block' && raw['kind'] !== 'file') {
    return invalid(`${prefix}.kind`, 'must be "block" or "file"', configPath);
  }
  const known = fields(raw, raw['kind'] === 'block' ? ['kind', 'ref'] : ['kind', 'path'], prefix, configPath);
  if (!known.success) return known;
  if (raw['kind'] === 'block') {
    const ref = raw['ref'];
    // Use the authored inclusion target grammar; do not trim, case-fold or resolve it.
    if (typeof ref !== 'string' || !/^(?:[a-z0-9]+(?:-[a-z0-9]+)*:)?[A-Za-z0-9_-]+$/.test(ref)
      || /\s/.test(ref)) return invalid(`${prefix}.ref`, 'must be an ID or alias:ID reference', configPath);
    return { success: true, data: Object.freeze({ kind: 'block', ref }) };
  }
  const path = relativePath(raw['path'], `${prefix}.path`, configPath);
  if (!path.success) return path;
  if (!path.data.startsWith(`${directory}/`)) {
    return invalid(`${prefix}.path`, 'must name a file beneath blocksDir', configPath, 'CONFIG_INVALID_PATH');
  }
  return { success: true, data: Object.freeze({ kind: 'file', path: path.data }) };
}

/**
 * Private pure validation of the outputSets field, not a replacement config reader.
 * blocksDir is supplied by the enclosing configuration validator. Results are copied
 * and frozen; absent outputSets is an empty library configuration. No discovery,
 * reference resolution, collision assessment or publication is performed here.
 */
export function normalizeOutputSets(raw: unknown, blocksDir: string, configPath: string): Result<OutputSets> {
  const directory = relativePath(blocksDir, 'blocksDir', configPath, true);
  if (!directory.success) return directory;
  if (raw !== undefined && !record(raw)) return invalid('outputSets', 'must be an object', configPath);
  const sets = Object.create(null) as Record<string, OutputSet>;
  for (const [name, value] of Object.entries(raw ?? {})) {
    const prefix = `outputSets[${JSON.stringify(name)}]`;
    if (name.length === 0) return invalid('outputSets', 'must have nonempty set names', configPath);
    if (!record(value)) return invalid(prefix, 'must be an object', configPath);
    const known = fields(value, ['targets', 'outputDir', 'ifExists', 'cleanup'], prefix, configPath);
    if (!known.success) return known;
    const outputDir = outputDirectory(value['outputDir'], `${prefix}.outputDir`, configPath);
    if (!outputDir.success) return outputDir;
    const ifExists = value['ifExists'] === undefined ? 'replace' : value['ifExists'];
    const cleanup = value['cleanup'] === undefined ? 'keep' : value['cleanup'];
    if (ifExists !== 'replace' && ifExists !== 'skip' && ifExists !== 'error') {
      return invalid(`${prefix}.ifExists`, 'must be "replace", "skip" or "error"', configPath);
    }
    if (cleanup !== 'keep' && cleanup !== 'prune') return invalid(`${prefix}.cleanup`, 'must be "keep" or "prune"', configPath);
    const rawTargets = value['targets'];
    if (!Array.isArray(rawTargets)) return invalid(`${prefix}.targets`, 'must be an explicit array', configPath);
    const targets: OutputTarget[] = [];
    for (let index = 0; index < rawTargets.length; index++) {
      const target: unknown = rawTargets[index];
      const targetPrefix = `${prefix}.targets[${index}]`;
      if (!record(target)) return invalid(targetPrefix, 'must be an object', configPath);
      const targetFields = fields(target, ['source', 'path'], targetPrefix, configPath);
      if (!targetFields.success) return targetFields;
      const source = sourceSelector(target['source'], directory.data, `${targetPrefix}.source`, configPath);
      if (!source.success) return source;
      const path = relativePath(target['path'], `${targetPrefix}.path`, configPath);
      if (!path.success) return path;
      targets.push(Object.freeze({ source: source.data, path: path.data }));
    }
    sets[name] = Object.freeze({ outputDir: outputDir.data, ifExists, cleanup, targets: Object.freeze(targets) });
  }
  return Object.freeze({ success: true, data: Object.freeze(sets) });
}
