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
import { isExternalStemGraphShape } from '@stemdev/core';
import { publishGraph } from '../../src/runtime/operations/publish.js';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('publishes versioned Block-only metadata with durable project identity and no source bodies', async () => {
  await f.config({ namespace: 'docs', publishUrl: 'https://example.test/metadata' });
  await f.put(
    'blocks/a.md',
    '@stem:block(id:a tags:[guide])Secret body@stem:block(id:b)B@stem:end()@stem:end()'
  );
  await f.put(
    '.stem/renames.json',
    JSON.stringify([
      { from: 'old', to: 'a', since: new Date().toISOString(), extra: 'ignored advisory field' }
    ])
  );
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
  vi.stubGlobal('fetch', fetch);
  vi.stubEnv('STEM_PUBLISH_KEY', 'test');
  const config = await cli.loadStemConfig(root);
  if (!config.success) throw new Error('config');
  expect((await publishGraph(config.data)).success).toBe(true);
  const body = String((fetch.mock.calls[0]![1] as { body: string }).body);
  expect(body).not.toContain('Secret body');
  expect(JSON.parse(body)).toMatchObject({
    version: '2',
    projectId: config.data.projectId,
    blocks: [
      { id: 'a', tags: ['guide'] },
      { id: 'b', tags: [] }
    ]
  });
  expect(body).not.toContain('sections');
  expect(body).not.toContain('ignored advisory field');
  expect(isExternalStemGraphShape(JSON.parse(body))).toBe(true);
});
it('invalid classification refuses metadata publication before transport', async () => {
  await f.config({ namespace: 'docs', publishUrl: 'https://example.test/metadata' });
  await f.put('blocks/a.md', '@stem:block(id:a)A@stem:end()@stem:block(id:a)B@stem:end()');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const config = await cli.loadStemConfig(root);
  if (!config.success) throw new Error('config');
  expect((await publishGraph(config.data)).success).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});
