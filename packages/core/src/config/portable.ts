import type { NamespaceConfig, StemConfig } from '../types/config.js';

import { normalizeOutputSets } from './outputs.js';
import type { OutputSets } from './outputs.js';

export interface PortableStemConfig {
  readonly projectId: string;
  readonly namespace?: string;
  readonly publishUrl?: string;
  readonly blocksDir: string;
  readonly outputSets: OutputSets;
  readonly cacheDir: string;
  readonly namespaces: Readonly<Record<string, NamespaceConfig>>;
}

export type { ConfigError, ConfigErrorCode } from '../types/config.js';
import type { ConfigError } from '../types/config.js';

export type ConfigResult<T> = { success: true; data: T } | { success: false; error: ConfigError };

export const STEM_CONFIG_FILE = '.stem/config.json';

export const STEM_CONFIG_DEFAULTS = {
  blocksDir: 'blocks',
  cacheDir: '.stem/cache'
} as const;

const CONFIG_PATH_FIELDS = ['blocksDir', 'cacheDir'] as const;
const CONFIG_FIELDS = [
  'projectId',
  'namespace',
  'publishUrl',
  ...CONFIG_PATH_FIELDS,
  'namespaces',
  'outputSets'
];
const NAMESPACE_FIELDS = ['graphUrl', 'localPath'];

type ConfigPathField = (typeof CONFIG_PATH_FIELDS)[number];

export function normalizeStemConfig(
  raw: Partial<StemConfig>,
  configPath: string
): ConfigResult<PortableStemConfig> {
  if (!isPlainObject(raw))
    return {
      success: false,
      error: {
        code: 'CONFIG_INVALID_SCHEMA',
        path: configPath,
        message: 'Stem config must be a JSON object.'
      }
    };
  const schemaResult = validateRawConfig(raw, configPath);
  if (!schemaResult.success) {
    return schemaResult;
  }

  if (
    typeof raw.projectId !== 'string' ||
    raw.projectId.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw.projectId)
  ) {
    return {
      success: false,
      error: {
        code: 'CONFIG_INVALID_SCHEMA',
        message:
          'Stem config field "projectId" is required and must be a lowercase hyphenated UUIDv4.',
        path: configPath
      }
    };
  }

  const blocksDirResult = normalizeConfigPath(
    raw.blocksDir ?? STEM_CONFIG_DEFAULTS.blocksDir,
    'blocksDir',
    configPath
  );
  if (!blocksDirResult.success) {
    return blocksDirResult;
  }

  const cacheDirResult = normalizeConfigPath(
    raw.cacheDir ?? STEM_CONFIG_DEFAULTS.cacheDir,
    'cacheDir',
    configPath
  );
  if (!cacheDirResult.success) {
    return cacheDirResult;
  }

  const namespacesResult = validateAndNormalizeNamespaces(raw.namespaces, configPath);
  if (!namespacesResult.success) {
    return namespacesResult;
  }

  const outputs = normalizeOutputSets(raw.outputSets, blocksDirResult.data, configPath);
  if (!outputs.success) return outputs;

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
    data: Object.freeze({
      projectId: raw.projectId,
      ...(raw.namespace !== undefined ? { namespace: raw.namespace } : {}),
      ...(raw.publishUrl !== undefined ? { publishUrl: raw.publishUrl } : {}),
      blocksDir: blocksDirResult.data,
      outputSets: outputs.data,
      cacheDir: cacheDirResult.data,
      namespaces: Object.freeze(namespacesResult.data)
    })
  };
}

export function parseConfigJson(
  content: string,
  configPath: string
): ConfigResult<Partial<StemConfig>> {
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
        message:
          error instanceof Error
            ? `Invalid Stem config JSON: ${error.message}`
            : 'Invalid Stem config JSON.',
        path: configPath
      }
    };
  }
}

function validateRawConfig(
  raw: Partial<StemConfig>,
  configPath: string
): ConfigResult<Partial<StemConfig>> {
  const fieldError = validateConfigFields(raw, CONFIG_FIELDS, configPath);
  if (fieldError !== undefined) return { success: false, error: fieldError };

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

function validateConfigFields(
  value: object,
  supported: readonly string[],
  configPath: string,
  prefix = ''
): ConfigError | undefined {
  const field = Object.keys(value).find((key) => !supported.includes(key));
  if (field === undefined) return undefined;
  return {
    code: 'CONFIG_INVALID_SCHEMA',
    message: `Unknown Stem config field "${prefix}${field}".`,
    path: configPath
  };
}

function normalizeConfigPath(
  configPathValue: string,
  field: ConfigPathField,
  configFilePath: string
): ConfigResult<string> {
  if (
    isAbsolutePath(configPathValue) ||
    /^[a-z][a-z\d+.-]*:/i.test(configPathValue) ||
    configPathValue.includes('\0')
  ) {
    return invalidPath(field, configPathValue, configFilePath, 'must be project-relative');
  }

  const withPosixSeparators = configPathValue.replaceAll('\\', '/');
  const pathSegments = withPosixSeparators.split('/');
  if (pathSegments.includes('..')) {
    return invalidPath(field, configPathValue, configFilePath, 'must not contain ".."');
  }

  const normalized = pathSegments.filter((segment) => segment !== '' && segment !== '.').join('/');
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

    const fieldError = validateConfigFields(
      value,
      NAMESPACE_FIELDS,
      configPath,
      `namespaces.${key}.`
    );
    if (fieldError !== undefined) return { success: false, error: fieldError };

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

    result[key] = Object.freeze({
      ...(graphUrl ? { graphUrl } : {}),
      ...(normalizedLocalPath ? { localPath: normalizedLocalPath } : {})
    });
  }

  return { success: true, data: result };
}

function normalizeNamespaceLocalPath(
  localPathValue: string,
  namespace: string,
  configFilePath: string
): ConfigResult<string> {
  if (isAbsolutePath(localPathValue)) {
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

// Recognize POSIX roots, Windows rooted paths, UNC paths, and drive roots on every host.
function isAbsolutePath(value: string): boolean {
  return /^[\\/]/.test(value) || /^[A-Za-z]:[\\/]/.test(value);
}
