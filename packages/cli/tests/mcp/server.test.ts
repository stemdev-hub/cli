import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';

import { createMcpServer } from '../../src/mcp/server.js';
import * as listOps from '../../src/core/operations/list.js';
import * as projectOps from '../../src/core/operations/project.js';
import * as checkOps from '../../src/core/operations/check.js';
import * as renderOps from '../../src/core/operations/render.js';
import * as readerOps from '../../src/core/fs/reader.js';

// Mock dependencies
vi.mock('../../src/core/operations/list.js');
vi.mock('../../src/core/operations/project.js');
vi.mock('../../src/core/operations/check.js');
vi.mock('../../src/core/operations/render.js');
vi.mock('../../src/core/fs/reader.js');

describe('MCP Server', () => {
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeEach(async () => {
    vi.resetAllMocks();

    const mcpServer = createMcpServer();
    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    clientTransport = cTransport;
    serverTransport = sTransport;

    await mcpServer.connect(serverTransport);

    client = new Client({ name: 'test', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await serverTransport.close();
  });

  describe('Tools', () => {
    it('list_blocks returns blocks data', async () => {
      const mockResult = {
        success: true as const,
        data: {
          blocks: [{ id: 'b1', tags: [], relativePath: 'b1.md', usedInViews: [], sectionCount: 0, standaloneTagCount: 0 }],
          total: 1
        }
      };
      vi.spyOn(listOps, 'listBlocks').mockResolvedValue(mockResult);

      const result = await client.callTool({
        name: 'list_blocks',
        arguments: { tag: 'foo' }
      });

      expect(listOps.listBlocks).toHaveBeenCalledWith({ startDir: process.cwd(), tag: 'foo' });
      expect(result.structuredContent).toEqual(mockResult.data);
      expect(result.isError).toBeUndefined();
    });

    it('list_views returns views data', async () => {
      const mockResult = {
        success: true as const,
        data: {
          views: [{ id: 'v1', group: null, relativePath: 'v1.md', blockCount: 0, blockIds: [] }],
          total: 1
        }
      };
      vi.spyOn(listOps, 'listViews').mockResolvedValue(mockResult);

      const result = await client.callTool({
        name: 'list_views',
        arguments: {}
      });

      expect(listOps.listViews).toHaveBeenCalledWith({ startDir: process.cwd() });
      expect(result.structuredContent).toEqual(mockResult.data);
    });

    it('check_references returns validation issues', async () => {
      const mockValidation = {
        issues: [{ code: 'ERR_BROKEN', message: 'Broken link', severity: 'error', relativePath: 'b1.md' }],
        errorCount: 1,
        warningCount: 0,
        hasErrors: true,
        hasWarnings: false
      };
      const checkResult = {
        success: true,
        data: { validation: mockValidation, scannedFiles: 1, durationMs: 10 }
      } as unknown as Awaited<ReturnType<typeof checkOps.checkProject>>;
      vi.spyOn(checkOps, 'checkProject').mockResolvedValue(checkResult);

      const result = await client.callTool({
        name: 'check_references',
        arguments: {}
      });

      expect(checkOps.checkProject).toHaveBeenCalled();
      expect(result.structuredContent).toEqual(mockValidation);
    });
  });

  describe('Resources', () => {
    it('stem://blocks/{id} returns raw markdown', async () => {
      const mockProjectResult = {
        success: true,
        data: {
          blocks: [{ id: 'b1', filePath: '/fake/path/b1.md' }]
        }
      } as unknown as Awaited<ReturnType<typeof projectOps.loadProjectGraph>>;
      vi.spyOn(projectOps, 'loadProjectGraph').mockResolvedValue(mockProjectResult);
      vi.spyOn(readerOps, 'readFile').mockResolvedValue({ success: true, data: '# Block 1' });

      const result = await client.readResource({
        uri: 'stem://blocks/b1'
      });

      expect(result.contents).toEqual([
        {
          uri: 'stem://blocks/b1',
          mimeType: 'text/markdown',
          text: '# Block 1'
        }
      ]);
      expect(readerOps.readFile).toHaveBeenCalledWith('/fake/path/b1.md');
    });

    it('stem://views/{id} returns composed markdown', async () => {
      const mockRenderResult = {
        success: true,
        data: {
          views: [{ id: 'v1', markdown: '# View 1 composed' }]
        }
      } as unknown as Awaited<ReturnType<typeof renderOps.renderView>>;
      vi.spyOn(renderOps, 'renderView').mockResolvedValue(mockRenderResult);

      const result = await client.readResource({
        uri: 'stem://views/v1'
      });

      expect(renderOps.renderView).toHaveBeenCalledWith('v1', { startDir: process.cwd(), stdout: true });
      expect(result.contents).toEqual([
        {
          uri: 'stem://views/v1',
          mimeType: 'text/markdown',
          text: '# View 1 composed'
        }
      ]);
    });
  });
});
