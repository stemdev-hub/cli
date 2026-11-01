import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, expect, it } from 'vitest';
import * as cli from '../../src/index.js';
let root: string;
const f = {
  put: async (relative: string, text: string) => {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  },
  read: (relative: string) => fs.readFile(path.join(root, relative), 'utf8'),
  config: async (extra: object) => {
    const original = JSON.parse(await f.read('.stem/config.json')) as object;
    await f.put('.stem/config.json', JSON.stringify({ ...original, ...extra }));
  }
};
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'stem-integration-'));
  expect((await cli.initProject({ startDir: root })).success).toBe(true);
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
import { vi } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createMcpServer } from '../../src/mcp/server.js';
let client: Client;
let server: ReturnType<typeof createMcpServer>;
beforeEach(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  server = createMcpServer();
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  client = new Client({ name: 'tests', version: '1' }, { capabilities: {} });
  await client.connect(a);
});
afterEach(async () => {
  await client.close();
  await server.close();
  vi.restoreAllMocks();
});
it('advertises read-only replacement tools and no View resource', async () => {
  const tools = await client.listTools();
  expect(tools.tools.map((t) => t.name)).toEqual([
    'list_blocks',
    'list_references',
    'list_outputs',
    'check_references',
    'preview_source'
  ]);
  expect(tools.tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  expect(
    (await client.listResourceTemplates()).resourceTemplates.map((t) => t.uriTemplate)
  ).toEqual(['stem://blocks/{id}']);
});
it('returns matching structured/text envelopes including partial preview', async () => {
  await f.put('blocks/a.md', 'pre@stem:include(missing)post');
  const result = await client.callTool({
    name: 'preview_source',
    arguments: { source: { kind: 'file', path: 'blocks/a.md' } }
  });
  expect(result.isError).toBe(false);
  expect(result.structuredContent).toMatchObject({
    success: true,
    data: { content: 'prepost', complete: false }
  });
  expect(result.content).toEqual([
    { type: 'text', text: JSON.stringify(result.structuredContent) }
  ]);
});
it('flags only operation failures and preserves their structured envelope', async () => {
  await f.config({ viewsDir: 'retired' });
  const result = await client.callTool({ name: 'list_blocks', arguments: {} });
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toMatchObject({
    success: false,
    error: { code: 'CONFIG_ERROR' }
  });
  expect(result.content).toEqual([
    { type: 'text', text: JSON.stringify(result.structuredContent) }
  ]);
});
it('extracts exactly the selected authored range from the analyzed source', async () => {
  await f.put(
    'blocks/a.md',
    'before@stem:block(id:a)@stem:block(id:b)Child@stem:end(id:b)@stem:end(id:a)after'
  );
  const result = await client.readResource({ uri: 'stem://blocks/b' });
  expect(result.contents[0]).toMatchObject({ text: '@stem:block(id:b)Child@stem:end(id:b)' });
});
