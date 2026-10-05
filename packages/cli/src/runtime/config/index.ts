import path from 'node:path';

import type { ResolvedStemConfig } from '../types/index.js';
import type { ConfigResult, StemConfig } from '@stemdev/core';
import { readFile } from '../fs/reader.js';
import { getDefaultPortableConfig, normalizeStemConfig, parseConfigJson, STEM_CONFIG_FILE } from '@stemdev/core';
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
  const result = normalizeStemConfig(raw, path.join(projectRoot, STEM_CONFIG_FILE));
  if (!result.success) return result;
  return { success: true, data: { ...result.data, projectRoot: path.resolve(projectRoot) } };
}

export function getDefaultStemConfig(projectRoot: string): ResolvedStemConfig {
  return { ...getDefaultPortableConfig(), projectRoot: path.resolve(projectRoot) };
}
