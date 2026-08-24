import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod/v4';

import { listBlocks, listViews } from '../core/operations/list.js';
import { renderView } from '../core/operations/render.js';
import { checkProject } from '../core/operations/check.js';
import { loadProjectGraph } from '../core/operations/project.js';
import { readFile } from '../core/fs/reader.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'stem',
    version: '0.1.0'
  });

  // ==========================================
  // RESOURCES (For large payloads)
  // ==========================================

  server.registerResource(
    'stem-block',
    new ResourceTemplate('stem://blocks/{id}', { list: undefined }),
    {
      description: 'Raw Markdown source of a Stem block',
    },
    async (uri, { id }) => {
      const blockId = String(id);
      const projectResult = await loadProjectGraph({ startDir: process.cwd() });
      if (!projectResult.success) {
        throw new Error(`Failed to load project: ${projectResult.error.message}`);
      }

      const block = projectResult.data.blocks.find(b => b.id === blockId);
      if (!block) {
        throw new Error(`Block not found: ${blockId}`);
      }

      const readResult = await readFile(block.filePath);
      if (!readResult.success) {
        throw new Error(`Failed to read block file: ${readResult.error.message}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: readResult.data,
            mimeType: 'text/markdown'
          }
        ]
      };
    }
  );

  server.registerResource(
    'stem-view',
    new ResourceTemplate('stem://views/{id}', { list: undefined }),
    {
      description: 'Composed Markdown output of a Stem view',
    },
    async (uri, { id }) => {
      const viewId = String(id);
      const renderResult = await renderView(viewId, { startDir: process.cwd(), stdout: true });
      if (!renderResult.success) {
        throw new Error(`Failed to render view: ${renderResult.error.message}`);
      }

      const markdown = renderResult.data.views[0]?.markdown;
      if (markdown === undefined || markdown === null) {
        throw new Error(`View markdown was not generated for: ${viewId}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: markdown,
            mimeType: 'text/markdown'
          }
        ]
      };
    }
  );

  // ==========================================
  // TOOLS (For intelligent graph navigation)
  // ==========================================

  server.registerTool(
    'list_blocks',
    {
      description: 'List all Stem blocks',
      inputSchema: z.object({
        tag: z.string().optional().describe('Filter blocks by tag')
      }),
      // Defining output schema as per July 2026 spec recommendations
      outputSchema: z.object({
        blocks: z.array(z.object({
          id: z.string(),
          relativePath: z.string(),
          tags: z.array(z.string()),
          usedInViews: z.array(z.string()),
          sectionCount: z.number(),
          standaloneTagCount: z.number()
        })),
        total: z.number()
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ tag }) => {
      const result = await listBlocks({ startDir: process.cwd(), ...(tag !== undefined ? { tag } : {}) });
      if (!result.success) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Operation failed: ${result.error.message}` }]
        };
      }
      
      // With output schemas, we return structured JSON directly alongside a text fallback
      return {
        content: [{ type: 'text', text: JSON.stringify(result.data) }],
        structuredContent: result.data
      };
    }
  );

  server.registerTool(
    'list_views',
    {
      description: 'List all Stem views',
      inputSchema: z.object({
        blockId: z.string().optional().describe('Filter views that use a specific block')
      }),
      outputSchema: z.object({
        views: z.array(z.object({
          id: z.string(),
          group: z.string().nullable(),
          relativePath: z.string(),
          blockCount: z.number(),
          blockIds: z.array(z.string())
        })),
        total: z.number()
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ blockId }) => {
      const result = await listViews({ startDir: process.cwd(), ...(blockId !== undefined ? { blockId } : {}) });
      if (!result.success) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Operation failed: ${result.error.message}` }]
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result.data) }],
        structuredContent: result.data
      };
    }
  );

  server.registerTool(
    'check_references',
    {
      description: 'Check Stem project for broken references, validation errors, and cycles',
      inputSchema: z.object({}),
      outputSchema: z.object({
        issues: z.array(z.object({
          code: z.string(),
          message: z.string(),
          severity: z.enum(['error', 'warning']),
          relativePath: z.string()
        })),
        errorCount: z.number(),
        warningCount: z.number(),
        hasErrors: z.boolean(),
        hasWarnings: z.boolean()
      }),
      annotations: { readOnlyHint: true }
    },
    async () => {
      const result = await checkProject({ startDir: process.cwd() });
      if (!result.success) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Operation failed: ${result.error.message}` }]
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result.data.validation) }],
        structuredContent: result.data.validation
      };
    }
  );

  return server;
}

export function startMcpServer(): void {
  void serveStdio(() => createMcpServer());
}
