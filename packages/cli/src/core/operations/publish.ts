import crypto from 'node:crypto';
import path from 'node:path';
import type { OperationResult, ResolvedStemConfig, ExternalStemGraph, ExternalBlockEntry, ExternalRenameEntry, ProjectOperationOptions, PublishGraphResult } from '@stem/types';
import { loadProjectGraph } from './project.js';
import { resolveAuthHeaders } from '../network/auth.js';
import { networkFetch } from '../network/client.js';
import { readFile } from '../fs/reader.js';
import { operationError } from './errors.js';

export async function publishGraph(
  config: ResolvedStemConfig,
  options: ProjectOperationOptions = {}
): Promise<OperationResult<PublishGraphResult>> {
  if (!config.namespace) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Project identity is missing. Add a "namespace" field to the root of .stem/config.json.`)
    };
  }

  if (!config.publishUrl) {
    return {
      success: false,
      error: operationError('INVALID_OPERATION', `Publish destination is missing. Add a "publishUrl" field to the root of .stem/config.json.`)
    };
  }

  const projectResult = await loadProjectGraph({ startDir: config.projectRoot, ...options });
  if (!projectResult.success) {
    return projectResult;
  }

  const blocks: ExternalBlockEntry[] = projectResult.data.blocks.map(block => {
    // Map internal blocks to ExternalBlockEntry stripping prose and paths
    return {
      id: block.id,
      tags: block.tags,
      sections: block.sections.map(section => ({
        id: section.name,
        tags: section.tags.map(t => t.name)
      }))
    };
  });

  const renamesPath = path.join(config.projectRoot, '.stem', 'renames.json');
  let renames: ExternalRenameEntry[] = [];
  const renamesReadResult = await readFile(renamesPath);
  if (renamesReadResult.success) {
    try {
      const parsedRenames: unknown = JSON.parse(renamesReadResult.data);
      if (!Array.isArray(parsedRenames)) {
        throw new Error('renames.json is not an array');
      }

      const validRenames: ExternalRenameEntry[] = [];
      for (const entry of parsedRenames) {
        if (
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as { from?: unknown }).from === 'string' &&
          typeof (entry as { to?: unknown }).to === 'string' &&
          typeof (entry as { since?: unknown }).since === 'string'
        ) {
          validRenames.push(entry as ExternalRenameEntry);
        }
      }

      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      renames = validRenames.filter(entry => {
        const sinceTime = new Date(entry.since).getTime();
        return !isNaN(sinceTime) && sinceTime > ninetyDaysAgo;
      });
    } catch {
      console.warn('Failed to parse .stem/renames.json. Ignoring rename history for publish.');
      renames = [];
    }
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.id.localeCompare(b.id));
  const sortedRenames = [...renames].sort((a, b) => a.from.localeCompare(b.from));

  const contentSha = `sha256:${crypto
    .createHash('sha256')
    .update(JSON.stringify({ blocks: sortedBlocks, renames: sortedRenames }))
    .digest('hex')}`;

  const graphPayload: ExternalStemGraph = {
    version: '1',
    namespace: config.namespace,
    publishedAt: new Date().toISOString(),
    contentSha,
    blocks: sortedBlocks,
    renames: sortedRenames
  };

  const authResult = await resolveAuthHeaders();
  if (!authResult.success) {
    return {
      success: false,
      error: operationError('AUTH_ERROR', authResult.error)
    };
  }

  const fetchResult = await networkFetch(config.publishUrl, {
    method: 'PUT',
    headers: {
      ...authResult.headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graphPayload, null, 2)
  });

  if (!fetchResult.success) {
    return {
      success: false,
      error: operationError('NETWORK_ERROR', `Failed to upload graph to ${config.publishUrl}: ${fetchResult.status} ${fetchResult.error || ''}`)
    };
  }

  return {
    success: true,
    data: {
      namespace: config.namespace,
      uploadedTo: config.publishUrl
    }
  };
}
