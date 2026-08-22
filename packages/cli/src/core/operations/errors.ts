import type { OperationError, OperationErrorCode } from '@stem/types';

interface SourceError {
  code: string;
  message: string;
  path?: string;
}

export function operationError(
  code: OperationErrorCode,
  message: string,
  options: { path?: string; cause?: unknown } = {}
): OperationError {
  return {
    code,
    message,
    ...(options.path === undefined ? {} : { path: options.path }),
    ...(options.cause === undefined ? {} : { cause: options.cause })
  };
}

export function fromFsError(error: SourceError): OperationError {
  const options = error.path === undefined ? { cause: error } : { path: error.path, cause: error };

  return operationError(
    error.code === 'NO_PROJECT_ROOT' ? 'PROJECT_ROOT_NOT_FOUND' : 'FS_ERROR',
    error.message,
    options
  );
}

export function fromConfigError(error: SourceError): OperationError {
  const options = error.path === undefined ? { cause: error } : { path: error.path, cause: error };

  return operationError('CONFIG_ERROR', error.message, options);
}

export function fromCacheError(error: SourceError): OperationError {
  const options = error.path === undefined ? { cause: error } : { path: error.path, cause: error };

  return operationError('CACHE_ERROR', error.message, options);
}
