import { describe, expect, it } from 'vitest';

import {
  fromCacheError,
  fromConfigError,
  fromFsError,
  operationError
} from '../../src/core/operations/errors.js';

describe('operationError', () => {
  it('returns a minimal OperationError without optional fields', () => {
    const result = operationError('FS_ERROR', 'Something broke');
    expect(result).toEqual({ code: 'FS_ERROR', message: 'Something broke' });
  });

  it('includes path when provided', () => {
    const result = operationError('FS_ERROR', 'Missing', { path: '/blocks/auth.md' });
    expect(result).toMatchObject({ code: 'FS_ERROR', path: '/blocks/auth.md' });
  });

  it('includes cause when provided', () => {
    const cause = { code: 'ENOENT', message: 'raw' };
    const result = operationError('FS_ERROR', 'Wrapped', { cause });
    expect(result).toMatchObject({ code: 'FS_ERROR', cause });
  });
});

describe('fromFsError', () => {
  it('maps NO_PROJECT_ROOT code to PROJECT_ROOT_NOT_FOUND', () => {
    const result = fromFsError({ code: 'NO_PROJECT_ROOT', message: 'No root found' });
    expect(result.code).toBe('PROJECT_ROOT_NOT_FOUND');
  });

  it('maps other error codes to FS_ERROR', () => {
    const result = fromFsError({ code: 'ENOENT', message: 'Not found', path: '/blocks/auth.md' });
    expect(result.code).toBe('FS_ERROR');
    expect(result.path).toBe('/blocks/auth.md');
  });
});

describe('fromConfigError', () => {
  it('returns a CONFIG_ERROR operation error', () => {
    const result = fromConfigError({ code: 'PARSE_FAILED', message: 'Invalid JSON' });
    expect(result).toMatchObject({ code: 'CONFIG_ERROR', message: 'Invalid JSON' });
  });

  it('includes path when the source error has a path', () => {
    const result = fromConfigError({ code: 'NOT_FOUND', message: 'Missing config', path: '/.stem/config.json' });
    expect(result).toMatchObject({ code: 'CONFIG_ERROR', path: '/.stem/config.json' });
  });
});

describe('fromCacheError', () => {
  it('returns a CACHE_ERROR operation error', () => {
    const result = fromCacheError({ code: 'WRITE_FAILED', message: 'Cannot write cache' });
    expect(result).toMatchObject({ code: 'CACHE_ERROR', message: 'Cannot write cache' });
  });

  it('includes path when the source error has a path', () => {
    const result = fromCacheError({ code: 'WRITE_FAILED', message: 'Cannot write', path: '/.stem/cache/index.json' });
    expect(result).toMatchObject({ code: 'CACHE_ERROR', path: '/.stem/cache/index.json' });
  });
});
