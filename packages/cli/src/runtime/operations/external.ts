import path from 'node:path';
import type { ResolvedStemConfig, ProjectOperationOptions } from '../types/index.js';
import type { ExternalSnapshotState } from '@stemdev/core';
import { readFile } from '../fs/reader.js';
import { decodeExternalSnapshotEnvelope, isExternalStemGraphShape } from '@stemdev/core';

export async function loadExternalGraphs(
  config: ResolvedStemConfig,
  options?: ProjectOperationOptions
): Promise<Map<string, ExternalSnapshotState>> {
  const externalGraphs = new Map<string, ExternalSnapshotState>();

  for (const [namespace, namespaceConfig] of Object.entries(config.namespaces)) {
    if (!options?.useRemote && namespaceConfig.localPath !== undefined) {
      const localGraphPath = path.join(
        config.projectRoot,
        namespaceConfig.localPath,
        '.stem',
        'cache',
        'stem-graph.json'
      );
      
      const readResult = await readFile(localGraphPath);
      if (readResult.success) {
        try {
          const parsed: unknown = JSON.parse(readResult.data);
          if (isExternalStemGraphShape(parsed)) {
            externalGraphs.set(namespace, {
              graph: parsed,
              fetchedAt: new Date().toISOString(),
              isLocalFallback: true
            });
            continue;
          }
        } catch {
          // Fall through to MISSING_SNAPSHOT if JSON parsing fails
        }
      } else {
        console.warn(`Local path for namespace "${namespace}" not found. Falling back to graphUrl cache.`);
      }
    }

    const cachedSnapshotPath = path.join(
      config.projectRoot,
      '.stem',
      'cache',
      'namespaces',
      `${namespace}.json`
    );

    const readResult = await readFile(cachedSnapshotPath);
    if (readResult.success) {
      try {
        const envelope: unknown = JSON.parse(readResult.data);
        const snapshot = decodeExternalSnapshotEnvelope(envelope);
        if (snapshot !== undefined) {
          externalGraphs.set(namespace, snapshot);
        }
      } catch {
        // Fall through to MISSING_SNAPSHOT if JSON parsing fails
      }
    }
  }

  return externalGraphs;
}
