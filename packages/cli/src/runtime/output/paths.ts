import { lstat, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export type OutputErrorCode = 'INVALID_PATH' | 'CONFLICT' | 'IO_ERROR' | 'MANIFEST_CORRUPT'
  | 'MANIFEST_UNSUPPORTED' | 'LOCK_BUSY' | 'LOCK_LOST' | 'LOCK_RELEASE_FAILED';

/** Private adapter errors; public operation/result mapping belongs to the later publisher. */
export class OutputError extends Error {
  constructor(readonly code: OutputErrorCode, message: string, readonly path: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'OutputError';
  }
}

export function outputError(error: unknown, filePath: string): OutputError {
  return error instanceof OutputError ? error : new OutputError('IO_ERROR', `Cannot inspect or update ${filePath}.`, filePath, error);
}

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

export interface OutputRoot {
  readonly path: string;
  readonly requestedPath: string;
  readonly projectRoot: string;
  /** Caller supplies configured source/cache paths and loaded projects' protected paths. */
  readonly protectedPaths: readonly string[];
}

export interface OutputPath {
  readonly path: string;
  readonly identity: string | undefined;
}

export function isCanonicalOutputPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('\0')
    && !value.includes('\\') && !path.posix.isAbsolute(value) && !path.win32.isAbsolute(value)
    && !/^[a-z]:/i.test(value) && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

function checkNativePath(value: string): void {
  if (value.length === 0 || value.includes('\0')) throw new OutputError('INVALID_PATH', 'Output path must not be empty or contain NUL.', value);
  if (process.platform !== 'win32') {
    if (value.includes('\\') || /^[a-z]:/i.test(value)) throw new OutputError('INVALID_PATH', 'Output path is incompatible with this host.', value);
    return;
  }
  // Win32 normalizes trailing dots/spaces and recognizes device names/alternate streams.
  // Reject these spellings instead of letting two mappings address the same file.
  const suffix = value.slice(path.parse(value).root.length);
  for (const part of suffix.split(/[\\/]/)) {
    if (part === '' || part === '.' || part === '..') continue;
    if (/[<>:"|?*]/.test(part) || [...part].some(c => c.charCodeAt(0) < 32)
      || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part)) {
      throw new OutputError('INVALID_PATH', 'Output path has an unsafe Windows filename.', value);
    }
  }
}

function isFullyQualified(value: string): boolean {
  if (!path.isAbsolute(value)) return false;
  return process.platform !== 'win32' || /^(?:[a-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/i.test(value);
}

export async function optionalStat(filePath: string) {
  try { return await lstat(filePath, { bigint: true }); }
  catch (error) { if (hasCode(error, 'ENOENT')) return undefined; throw error; }
}

/** Resolve existing ancestors without creating anything; dangling links remain errors. */
async function physicalPath(filePath: string, directory: boolean): Promise<string> {
  let ancestor = filePath;
  const missing: string[] = [];
  while (true) {
    const info = await optionalStat(ancestor);
    if (info !== undefined) {
      const resolved = await realpath(ancestor);
      if ((directory || missing.length > 0) && !(await stat(resolved)).isDirectory()) {
        throw new OutputError('INVALID_PATH', 'Expected a directory ancestor.', ancestor);
      }
      return path.join(resolved, ...missing.reverse());
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new OutputError('INVALID_PATH', 'Output path has no accessible root.', filePath);
    missing.push(path.basename(ancestor));
    ancestor = parent;
  }
}

function samePath(left: string, right: string): boolean {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function contained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function overlaps(left: string, right: string): boolean {
  // Case-only destinations conflict even on a case-sensitive host.
  return contained(left.toLowerCase(), right.toLowerCase()) || contained(right.toLowerCase(), left.toLowerCase());
}

export async function resolveOutputRoot(
  projectRoot: string, outputDir: string, protectedPaths: readonly string[]
): Promise<OutputRoot> {
  try {
    if (!isFullyQualified(projectRoot)) throw new OutputError('INVALID_PATH', 'Project root must be fully qualified.', projectRoot);
    checkNativePath(outputDir);
    if (/^[a-z][a-z\d+.-]*:/i.test(outputDir) && !isFullyQualified(outputDir)
      || path.isAbsolute(outputDir) && !isFullyQualified(outputDir)) {
      throw new OutputError('INVALID_PATH', 'Output directory must be relative or a native fully qualified path.', outputDir);
    }
    const project = await physicalPath(projectRoot, true);
    const requestedPath = path.resolve(projectRoot, outputDir);
    const resolved = await physicalPath(requestedPath, true);
    const protections = protectedPaths.map(p => {
      checkNativePath(p);
      if (!isFullyQualified(p)) throw new OutputError('INVALID_PATH', 'Protected paths must be fully qualified.', p);
      return path.normalize(p);
    });
    return Object.freeze({ path: resolved, requestedPath, projectRoot: project,
      protectedPaths: Object.freeze([...protections, path.join(project, '.git'), path.join(project, '.stem/config.json')]) });
  } catch (error) { throw outputError(error, outputDir); }
}

export async function revalidateOutputRoot(root: OutputRoot): Promise<void> {
  try {
    if (!samePath(await physicalPath(root.requestedPath, true), root.path)) {
      throw new OutputError('INVALID_PATH', 'Output root changed since resolution.', root.requestedPath);
    }
  } catch (error) { throw outputError(error, root.requestedPath); }
}

async function inspectPath(root: OutputRoot, relativePath: string, bookkeeping: boolean): Promise<OutputPath> {
  if (!isCanonicalOutputPath(relativePath)) throw new OutputError('INVALID_PATH', 'Expected a canonical relative output file path.', relativePath);
  checkNativePath(relativePath);
  const requested = path.join(root.path, ...relativePath.split('/'));
  const info = await optionalStat(requested);
  if (info !== undefined && (!info.isFile() || info.isSymbolicLink())) {
    throw new OutputError('INVALID_PATH', 'Output must be a regular file, not a directory or symlink.', requested);
  }
  const resolved = await physicalPath(requested, false);
  if (!contained(root.path, resolved) || samePath(root.path, resolved)) {
    throw new OutputError('INVALID_PATH', 'Output escapes its resolved root.', requested);
  }
  const identity = info === undefined ? undefined : `${info.dev}:${info.ino}`;
  const protections = bookkeeping ? root.protectedPaths
    : [...root.protectedPaths, path.join(root.projectRoot, '.stem'), path.join(root.path, '.stem')];
  for (const protectedPath of protections) {
    const actual = await physicalPath(protectedPath, false);
    const protectedInfo = await optionalStat(actual);
    if (overlaps(resolved, actual) || identity !== undefined && protectedInfo?.isFile()
      && identity === `${protectedInfo.dev}:${protectedInfo.ino}`) {
      throw new OutputError('INVALID_PATH', 'Output conflicts with a protected path.', requested);
    }
  }
  return Object.freeze({ path: resolved, identity });
}

export function assertNoOutputCollisions(paths: readonly OutputPath[]): void {
  for (let i = 0; i < paths.length; i++) {
    const current = paths[i]!;
    for (const earlier of paths.slice(0, i)) {
      if (overlaps(current.path, earlier.path) || current.identity !== undefined && current.identity === earlier.identity) {
        throw new OutputError('CONFLICT', 'Output destinations collide.', current.path);
      }
    }
  }
}

/** Read-only, for a supplied plan or manifest. Re-run immediately before mutation. */
export async function inspectOutputPaths(root: OutputRoot, paths: readonly string[]): Promise<readonly OutputPath[]> {
  try {
    await revalidateOutputRoot(root);
    const inspected: OutputPath[] = [];
    for (const p of paths) inspected.push(await inspectPath(root, p, false));
    assertNoOutputCollisions(inspected);
    return Object.freeze(inspected);
  } catch (error) { throw outputError(error, root.path); }
}

export async function inspectBookkeepingPath(root: OutputRoot, name: 'outputs.json' | 'outputs.lock'): Promise<string> {
  try {
    await revalidateOutputRoot(root);
    return (await inspectPath(root, `.stem/${name}`, true)).path;
  } catch (error) { throw outputError(error, root.path); }
}
