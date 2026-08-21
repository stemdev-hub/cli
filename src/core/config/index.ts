import path from 'node:path';

import type { NamespaceConfig, ResolvedStemConfig, StemConfig } from '@stem/types';
import { readFile } from '../fs/reader.js';

export type ConfigErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_READ_FAILED'
  | 'CONFIG_INVALID_JSON'
  | 'CONFIG_INVALID_SCHEMA'
  | 'CONFIG_INVALID_PATH'
  | 'CONFIG_UNSUPPORTED_VERSION';

export interface ConfigError {
  code: ConfigErrorCode;
  message: string;
  path: string;
}

export type ConfigResult<T> = { success: true; data: T } | { success: false; error: ConfigError };

export const STEM_CONFIG_FILE = '.stem/config.json';

export const STEM_CONFIG_DEFAULTS = {
  version: '1',
  blocksDir: 'blocks',
  viewsDir: 'views',
  schemasDir: 'blocks/schemas',
  cacheDir: '.stem/cache'
} as const;

const SUPPORTED_CONFIG_VERSION = '1';
const CONFIG_PATH_FIELDS = ['blocksDir', 'viewsDir', 'schemasDir', 'cacheDir'] as const;

type ConfigPathField = (typeof CONFIG_PATH_FIELDS)[number];

export async function loadStemConfig(projectRoot: string): Promise<ConfigResult<ResolvedStemConfig>> {
  const configPath = path.join(projectRoot, STEM_CONFIG_FILE);
  const readResult = await readFile(configPath);

  if (!readResult.success) {
    if (readResult.error.code === 'NOT_FOUND') {
      return { success: true, data: getDefaultStemConfig(projectRoot) };
    }

    return {
      success: false,
      error: {
        code: 'CONFIG_READ_FAILED',
        message: `Failed to read Stem config at ${configPath}.`,
        path: configPath
      }
    };
  }

  const parseResult = parseConfigJson(readResult.data, configPath);
  if (!parseResult.success) {
    return parseResult;
  }

  return resolveStemConfig(parseResult.data, projectRoot);
}

export function resolveStemConfig(
  raw: Partial<StemConfig>,
  projectRoot: string
): ConfigResult<ResolvedStemConfig> {
  const schemaResult = validateRawConfig(raw, path.join(projectRoot, STEM_CONFIG_FILE));
  if (!schemaResult.success) {
    return schemaResult;
  }

  const version = raw.version ?? STEM_CONFIG_DEFAULTS.version;
  if (version !== SUPPORTED_CONFIG_VERSION) {
    return {
      success: false,
      error: {
        code: 'CONFIG_UNSUPPORTED_VERSION',
        message: `Unsupported Stem config version "${version}". Supported version is "${SUPPORTED_CONFIG_VERSION}".`,
        path: path.join(projectRoot, STEM_CONFIG_FILE)
      }
    };
  }

  const configPath = path.join(projectRoot, STEM_CONFIG_FILE);
  const blocksDirResult = normalizeConfigPath(raw.blocksDir ?? STEM_CONFIG_DEFAULTS.blocksDir, 'blocksDir', configPath);
  if (!blocksDirResult.success) {
    return blocksDirResult;
  }

  const viewsDirResult = normalizeConfigPath(raw.viewsDir ?? STEM_CONFIG_DEFAULTS.viewsDir, 'viewsDir', configPath);
  if (!viewsDirResult.success) {
    return viewsDirResult;
  }

  const schemasDirResult = normalizeConfigPath(
    raw.schemasDir ?? STEM_CONFIG_DEFAULTS.schemasDir,
    'schemasDir',
    configPath
  );
  if (!schemasDirResult.success) {
    return schemasDirResult;
  }

  const cacheDirResult = normalizeConfigPath(raw.cacheDir ?? STEM_CONFIG_DEFAULTS.cacheDir, 'cacheDir', configPath);
  if (!cacheDirResult.success) {
    return cacheDirResult;
  }

  const namespacesResult = validateAndNormalizeNamespaces(raw.namespaces, configPath);
  if (!namespacesResult.success) {
    return namespacesResult;
  }

  if (raw.namespace !== undefined) {
    const kebabCaseRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!kebabCaseRegex.test(raw.namespace)) {
      return {
        success: false,
        error: {
          code: 'CONFIG_INVALID_SCHEMA',
          message: `Stem config field "namespace" must be strictly kebab-case (e.g., "my-namespace").`,
          path: configPath
        }
      };
    }
    if (raw.namespace.startsWith('stem-')) {
      return {
        success: false,
        error: {
          code: 'CONFIG_INVALID_SCHEMA',
          message: `Stem config field "namespace" cannot start with the reserved prefix "stem-".`,
          path: configPath
        }
      };
    }
  }

  return {
    success: true,
    data: {
      version,
      ...(raw.namespace !== undefined ? { namespace: raw.namespace } : {}),
      ...(raw.publishUrl !== undefined ? { publishUrl: raw.publishUrl } : {}),
      projectRoot: path.resolve(projectRoot),
      blocksDir: blocksDirResult.data,
      viewsDir: viewsDirResult.data,
      schemasDir: schemasDirResult.data,
      cacheDir: cacheDirResult.data,
      namespaces: namespacesResult.data
    }
  };
}

export function getDefaultStemConfig(projectRoot: string): ResolvedStemConfig {
  return {
    version: STEM_CONFIG_DEFAULTS.version,
    projectRoot: path.resolve(projectRoot),
    blocksDir: STEM_CONFIG_DEFAULTS.blocksDir,
    viewsDir: STEM_CONFIG_DEFAULTS.viewsDir,
    schemasDir: STEM_CONFIG_DEFAULTS.schemasDir,
    cacheDir: STEM_CONFIG_DEFAULTS.cacheDir,
    namespaces: {}
  };
}

function parseConfigJson(content: string, configPath: string): ConfigResult<Partial<StemConfig>> {
  try {
    const parsed: unknown = JSON.parse(content);

    if (!isPlainObject(parsed)) {
      return {
        success: false,
        error: {
          code: 'CONFIG_INVALID_SCHEMA',
          message: 'Stem config must be a JSON object.',
          path: configPath
        }
      };
    }

    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'CONFIG_INVALID_JSON',
        message: error instanceof Error ? `Invalid Stem config JSON: ${error.message}` : 'Invalid Stem config JSON.',
        path: configPath
      }
    };
  }
}

function validateRawConfig(raw: Partial<StemConfig>, configPath: string): ConfigResult<Partial<StemConfig>> {
  if (!isOptionalString(raw.version)) {
    return invalidSchema('version', configPath);
  }

  if (!isOptionalString(raw.namespace)) {
    return invalidSchema('namespace', configPath);
  }

  if (!isOptionalString(raw.publishUrl)) {
    return invalidSchema('publishUrl', configPath);
  }

  for (const field of CONFIG_PATH_FIELDS) {
    if (!isOptionalString(raw[field])) {
      return invalidSchema(field, configPath);
    }
  }

  return { success: true, data: raw };
}

function normalizeConfigPath(
  configPathValue: string,
  field: ConfigPathField,
  configFilePath: string
): ConfigResult<string> {
  if (path.isAbsolute(configPathValue) || path.win32.isAbsolute(configPathValue) || path.posix.isAbsolute(configPathValue)) {
    return invalidPath(field, configPathValue, configFilePath, 'must be project-relative');
  }

  const withPosixSeparators = configPathValue.replaceAll('\\', '/');
  const pathSegments = withPosixSeparators.split('/');
  if (pathSegments.includes('..')) {
    return invalidPath(field, configPathValue, configFilePath, 'must not contain ".."');
  }

  const normalized = stripTrailingSlashes(stripLeadingDotSlash(withPosixSeparators));
  if (normalized.length === 0 || normalized === '.') {
    return invalidPath(field, configPathValue, configFilePath, 'must not be empty');
  }

  return { success: true, data: normalized };
}

function stripLeadingDotSlash(value: string): string {
  let current = value;

  while (current.startsWith('./')) {
    current = current.slice(2);
  }

  return current;
}

function stripTrailingSlashes(value: string): string {
  let current = value;

  while (current.endsWith('/')) {
    current = current.slice(0, -1);
  }

  return current;
}

function invalidSchema(field: string, configPath: string): ConfigResult<Partial<StemConfig>> {
  return {
    success: false,
    error: {
      code: 'CONFIG_INVALID_SCHEMA',
      message: `Stem config field "${field}" must be a string when provided.`,
      path: configPath
    }
  };
}

function invalidPath(
  field: ConfigPathField,
  value: string,
  configPath: string,
  reason: string
): ConfigResult<string> {
  return {
    success: false,
    error: {
      code: 'CONFIG_INVALID_PATH',
      message: `Stem config field "${field}" has invalid path "${value}": ${reason}.`,
      path: configPath
    }
  };
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isPlainObject(value: unknown): value is Partial<StemConfig> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateAndNormalizeNamespaces(
  rawNamespaces: unknown,
  configPath: string
): ConfigResult<Record<string, NamespaceConfig>> {
  if (rawNamespaces === undefined) {
    return { success: true, data: {} };
  }

  if (!isPlainObject(rawNamespaces)) {
    return {
      success: false,
      error: {
        code: 'CONFIG_INVALID_SCHEMA',
        message: `Stem config field "namespaces" must be an object when provided.`,
        path: configPath
      }
    };
  }

  const result: Record<string, NamespaceConfig> = {};
  const kebabCaseRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  for (const [key, value] of Object.entries(rawNamespaces)) {
    if (!kebabCaseRegex.test(key)) {
      return {
        success: false,
        error: {
          code: 'CONFIG_INVALID_SCHEMA',
          message: `Namespace key "${key}" must be strictly kebab-case (e.g., "my-namespace").`,
          path: configPath
        }
      };
    }
    
    if (key.startsWith('stem-')) {
      return {
        success: false,
        error: {
          code: 'CONFIG_INVALID_SCHEMA',
          message: `Namespace key "${key}" cannot start with the reserved prefix "stem-".`,
          path: configPath
        }
      };
    }

    if (!isPlainObject(value)) {
      return {
        success: false,
        error: {
          code: 'CONFIG_INVALID_SCHEMA',
          message: `Namespace entry "${key}" must be an object.`,
          path: configPath
        }
      };
    }

    const { graphUrl, localPath } = value as Record<string, unknown>;

    if (graphUrl === undefined && localPath === undefined) {
      return {
        success: false,
        error: {
          code: 'CONFIG_INVALID_SCHEMA',
          message: `Namespace '${key}' must specify at least one of graphUrl or localPath.`,
          path: configPath
        }
      };
    }

    if (graphUrl !== undefined && typeof graphUrl !== 'string') {
      return {
        success: false,
        error: {
          code: 'CONFIG_INVALID_SCHEMA',
          message: `Namespace '${key}' graphUrl must be a string.`,
          path: configPath
        }
      };
    }

    let normalizedLocalPath: string | undefined;

    if (localPath !== undefined) {
      if (typeof localPath !== 'string') {
        return {
          success: false,
          error: {
            code: 'CONFIG_INVALID_SCHEMA',
            message: `Namespace '${key}' localPath must be a string.`,
            path: configPath
          }
        };
      }
      
      const localPathResult = normalizeNamespaceLocalPath(localPath, key, configPath);
      if (!localPathResult.success) {
        return { success: false, error: localPathResult.error };
      }
      normalizedLocalPath = localPathResult.data;
    }

    result[key] = {
      ...(graphUrl ? { graphUrl } : {}),
      ...(normalizedLocalPath ? { localPath: normalizedLocalPath } : {})
    };
  }

  return { success: true, data: result };
}

function normalizeNamespaceLocalPath(
  localPathValue: string,
  namespace: string,
  configFilePath: string
): ConfigResult<string> {
  if (path.isAbsolute(localPathValue) || path.win32.isAbsolute(localPathValue) || path.posix.isAbsolute(localPathValue)) {
    return {
      success: false,
      error: {
        code: 'CONFIG_INVALID_PATH',
        message: `Namespace '${namespace}' localPath has invalid path "${localPathValue}": must be project-relative.`,
        path: configFilePath
      }
    };
  }

  const withPosixSeparators = localPathValue.replaceAll('\\', '/');
  const normalized = stripTrailingSlashes(stripLeadingDotSlash(withPosixSeparators));
  if (normalized.length === 0 || normalized === '.') {
     return {
      success: false,
      error: {
        code: 'CONFIG_INVALID_PATH',
        message: `Namespace '${namespace}' localPath has invalid path "${localPathValue}": must not be empty.`,
        path: configFilePath
      }
    };
  }

  return { success: true, data: normalized };
}
