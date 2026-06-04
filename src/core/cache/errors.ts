export type CacheErrorCode =
  | 'CACHE_READ_FAILED'
  | 'CACHE_WRITE_FAILED'
  | 'CACHE_INVALID_JSON'
  | 'CACHE_INVALID_SCHEMA'
  | 'CACHE_STAT_FAILED'
  | 'CACHE_HASH_FAILED';

export interface CacheError {
  code: CacheErrorCode;
  message: string;
  path: string;
}

export type CacheResult<T> = { success: true; data: T } | { success: false; error: CacheError };

export function cacheError(code: CacheErrorCode, message: string, errorPath: string): CacheError {
  return {
    code,
    message,
    path: errorPath
  };
}
