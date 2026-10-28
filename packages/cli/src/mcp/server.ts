import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod/v4';
import { isBlockId, resolveBlockReference } from '@stemdev/core';
import { listBlocks, listReferences, listOutputs } from '../runtime/operations/list.js';
import { previewSource } from '../runtime/operations/preview.js';
import { checkProject } from '../runtime/operations/check.js';
import { loadProjectGraph } from '../runtime/operations/project.js';
import type { OperationResult } from '../runtime/types/index.js';
const range = z.object({ startOffset: z.number(), endOffset: z.number() });
const location = z.object({ sourceId: z.string(), range });
const diagnostic = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
  location: location.optional(),
  related: z.array(location).optional()
});
const block = z.object({
  sourceId: z.string(),
  range,
  id: z.string().optional(),
  tags: z.array(z.string())
});
const source = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('block'), ref: z.string() }),
  z.object({ kind: z.literal('file'), path: z.string() })
]);
const error = z.object({ code: z.string(), message: z.string(), path: z.string().optional() });
const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ success: z.boolean(), data: data.optional(), error: error.optional() });
function response<T>(result: OperationResult<T>) {
  const payload = result.success
    ? result
    : {
        success: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          ...(result.error.path === undefined ? {} : { path: result.error.path })
        }
      };
  return {
    isError: !result.success,
    structuredContent: payload,
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }]
  };
}
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'stem', version: '0.1.0' });
  server.registerResource(
    'stem-block',
    new ResourceTemplate('stem://blocks/{id}', { list: undefined }),
    { description: 'Exact authored range of one local Block' },
    async (uri, { id }) => {
      if (typeof id !== 'string' || !isBlockId(id)) throw new Error('Invalid local Block ID.');
      const loaded = await loadProjectGraph();
      if (!loaded.success) throw new Error(loaded.error.message);
      const analysis = loaded.data.analysis;
      const selected = resolveBlockReference(analysis, analysis.localInstance, { id });
      if (selected.status !== 'resolved')
        throw new Error('Block selection is missing, ambiguous or unavailable.');
      const { source, syntax } = selected.target;
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: source.tree.source.content.slice(syntax.range.startOffset, syntax.range.endOffset)
          }
        ]
      };
    }
  );
  server.registerTool(
    'list_blocks',
    {
      description: 'List local recovered definitions and direct Tags',
      inputSchema: z.object({ tag: z.string().optional() }),
      outputSchema: envelope(
        z.object({
          blocks: z.array(block),
          total: z.number(),
          classificationComplete: z.boolean(),
          diagnostics: z.array(diagnostic)
        })
      ),
      annotations: { readOnlyHint: true }
    },
    async ({ tag }) => response(await listBlocks(tag === undefined ? {} : { tag }))
  );
  server.registerTool(
    'list_references',
    {
      description: 'List authored inclusions of one local Block',
      inputSchema: z.object({ id: z.string() }),
      outputSchema: envelope(
        z.object({
          references: z.array(z.object({ sourceId: z.string(), range, owner: block.optional() })),
          total: z.number(),
          complete: z.boolean(),
          diagnostics: z.array(diagnostic)
        })
      ),
      annotations: { readOnlyHint: true }
    },
    async ({ id }) => response(await listReferences(id))
  );
  server.registerTool(
    'list_outputs',
    {
      description: 'List normalized configured output mappings',
      inputSchema: z.object({}),
      outputSchema: envelope(
        z.object({
          outputSets: z.record(
            z.string(),
            z.object({
              outputDir: z.string(),
              ifExists: z.enum(['replace', 'skip', 'error']),
              cleanup: z.enum(['keep', 'prune']),
              targets: z.array(z.object({ source, path: z.string() }))
            })
          )
        })
      ),
      annotations: { readOnlyHint: true }
    },
    async () => response(await listOutputs())
  );
  server.registerTool(
    'check_references',
    {
      description: 'Check current source and configured-output reachability',
      inputSchema: z.object({}),
      outputSchema: envelope(
        z.object({
          diagnostics: z.array(diagnostic),
          errors: z.number(),
          warnings: z.number(),
          valid: z.boolean(),
          scannedFiles: z.number(),
          durationMs: z.number()
        })
      ),
      annotations: { readOnlyHint: true }
    },
    async () => response(await checkProject())
  );
  server.registerTool(
    'preview_source',
    {
      description: 'Compose a source with separate partial content and diagnostics',
      inputSchema: z.object({
        source,
        limits: z
          .object({
            maxWork: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
            maxOutputBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
          })
          .optional()
      }),
      outputSchema: envelope(
        z.object({ content: z.string(), complete: z.boolean(), diagnostics: z.array(diagnostic) })
      ),
      annotations: { readOnlyHint: true }
    },
    async ({ source: selector, limits }) =>
      response(await previewSource(selector, limits === undefined ? {} : { limits }))
  );
  return server;
}
export function startMcpServer(): void {
  void serveStdio(() => createMcpServer());
}
