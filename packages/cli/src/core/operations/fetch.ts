import path from 'node:path';
import type { OperationResult, ResolvedStemConfig, FetchNamespacesResult, ProjectOperationOptions } from '@stem/types';
import { isExternalStemGraphShape } from '../types/index.js';
import { networkFetch } from '../network/client.js';
import { writeFile } from '../fs/writer.js';
import { readFileStats } from '../fs/reader.js';
import { resolveAuthHeaders } from '../network/auth.js';

export async function fetchNamespaces(
  config: ResolvedStemConfig,
  options: ProjectOperationOptions = {}
): Promise<OperationResult<FetchNamespacesResult>> {
  const result: FetchNamespacesResult = {
    successes: [],
    skipped: [],
    warnings: []
  };

  let authHeaders: { Authorization: string } | undefined;
  const authResult = await resolveAuthHeaders();
  if (authResult.success) {
    authHeaders = authResult.headers;
  } else {
    result.warnings.push(`Authentication resolution failed: ${authResult.error}. Proceeding without credentials.`);
  }

  for (const [namespace, namespaceConfig] of Object.entries(config.namespaces)) {
    if (!namespaceConfig.graphUrl) {
      if (namespaceConfig.localPath) {
        if (options.useRemote) {
          result.warnings.push(`Namespace "${namespace}" has --use-remote flag but no graphUrl configured.`);
        } else {
          result.skipped.push(namespace);
        }
      } else {
        result.warnings.push(`Namespace "${namespace}" has no graphUrl or localPath configured.`);
      }
      continue;
    }

    if (namespaceConfig.localPath && !options.useRemote) {
      const localGraphPath = path.join(
        config.projectRoot,
        namespaceConfig.localPath,
        '.stem',
        'cache',
        'stem-graph.json'
      );
      const statResult = await readFileStats(localGraphPath);
      if (statResult.success) {
        result.skipped.push(namespace);
        continue;
      } else {
        result.warnings.push(`Local path for namespace "${namespace}" not found. Falling back to graphUrl.`);
      }
    }

    const fetchOptions = authHeaders ? { headers: authHeaders } : undefined;
    const fetchRes = await networkFetch(namespaceConfig.graphUrl, fetchOptions);
    if (!fetchRes.success || !fetchRes.data) {
      result.warnings.push(`Failed to download namespace "${namespace}": ${fetchRes.error || fetchRes.status}`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fetchRes.data);
    } catch {
      result.warnings.push(`Failed to parse JSON for namespace "${namespace}".`);
      continue;
    }

    if (!isExternalStemGraphShape(parsed)) {
      result.warnings.push(`Downloaded JSON for namespace "${namespace}" does not match ExternalStemGraph schema.`);
      continue;
    }

    const graph = parsed;

    if (graph.namespace !== namespace) {
      result.warnings.push(`Downloaded JSON claims namespace "${graph.namespace}", but configured as "${namespace}".`);
      continue;
    }

    const cachePath = path.join(
      config.projectRoot,
      '.stem',
      'cache',
      'namespaces',
      `${namespace}.json`
    );

    const envelope = {
      fetchedAt: new Date().toISOString(),
      graph
    };

    const writeResult = await writeFile(cachePath, JSON.stringify(envelope, null, 2), { overwrite: true });
    if (!writeResult.success) {
      result.warnings.push(`Failed to write cache file for namespace "${namespace}": ${writeResult.error.message}`);
      continue;
    }

    result.successes.push(namespace);
  }

  return { success: true, data: result };
}
