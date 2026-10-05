import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { build } from 'esbuild';
import { expect, it } from 'vitest';

it('runs project analysis through the public entry without Node globals or clock reads', async () => {
  const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
  const bundle = await build({
    stdin: {
      contents: "export { analyzeProject } from './index.ts';",
      resolveDir: fileURLToPath(new URL('../../src/', import.meta.url)),
      loader: 'ts'
    },
    bundle: true,
    platform: 'browser',
    conditions: ['worker'],
    format: 'iife',
    globalName: 'portable',
    write: false,
    plugins: [{
      name: 'reject-project-node-dependencies',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, ({ path }) => {
          if (path.startsWith('node:') || builtins.has(path) || path === 'gray-matter') {
            return { errors: [{ text: `Non-portable dependency: ${path}` }] };
          }
          return undefined;
        });
      }
    }]
  });
  const context = createContext(Object.create(null) as Record<string, unknown>);
  runInContext(`
    for (const name of ['Buffer', 'process', 'require', 'fetch', 'console', 'performance']) {
      Object.defineProperty(globalThis, name, { get() { throw new Error('Forbidden global: ' + name); } });
    }
    const NativeDate = Date;
    globalThis.Date = new Proxy(NativeDate, {
      apply() { throw new Error('Clock reads are forbidden'); },
      construct(target, args) {
        if (args.length === 0) throw new Error('Clock reads are forbidden');
        return Reflect.construct(target, args);
      },
      get(target, key) {
        if (key === 'now') return () => { throw new Error('Clock reads are forbidden'); };
        return Reflect.get(target, key);
      }
    });
  `, context);
  runInContext(bundle.outputFiles[0]!.text, context, { timeout: 5000 });
  const result = runInContext(`JSON.stringify(portable.analyzeProject({
    blocks: [],
    views: [{ content: '---\\nid: api\\n---\\n@stem[block:other:auth]', filePath: 'api.md', relativePath: 'api.md' }],
    schemas: new Map(), configuredNamespaces: { other: { graphUrl: 'unused' } },
    externalGraphs: new Map([['other', {
      fetchedAt: '1970-01-01T00:00:00.000Z', isLocalFallback: false,
      graph: { version: '1', namespace: 'other', publishedAt: '', contentSha: '', blocks: [], renames: [] }
    }]])
  }, { nowMs: 7 * 86400000 + 1, strictExternal: true }).validation)`, context, { timeout: 5000 }) as string;
  expect(JSON.parse(result)).toMatchObject({
    issues: [{ code: 'EXPIRED_SNAPSHOT', severity: 'error' }],
    errorCount: 1, warningCount: 0, hasErrors: true, hasWarnings: false
  });
});

it('bundles and executes the portable modules without Node dependencies or globals', async () => {
  const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
  const bundle = await build({
    stdin: {
      contents: `
        export { parseBlockFile, parseViewFile } from './parser/index.ts';
        export { parseFrontmatter } from './parser/frontmatter.ts';
        export { buildGraph } from './graph/builder.ts';
        export * from './graph/traverser.ts';
        export { validateGraph } from './validator/rules.ts';
        export { validateSchemas } from './validator/schema.ts';
        export { renderViewMarkdown } from './renderer/index.ts';
        export { normalizeStemConfig, parseConfigJson } from './config/portable.ts';
      `,
      resolveDir: fileURLToPath(new URL('../../src/', import.meta.url)),
      loader: 'ts'
    },
    bundle: true,
    platform: 'browser',
    // Select dependencies' native worker exports for a browser environment without a DOM.
    conditions: ['worker'],
    format: 'iife',
    globalName: 'portable',
    write: false,
    metafile: true,
    plugins: [{
      name: 'reject-node-dependencies',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, ({ path }) => {
          if (path.startsWith('node:') || builtins.has(path) || path === 'gray-matter') {
            return { errors: [{ text: `Non-portable dependency: ${path}` }] };
          }
          return undefined;
        });
      }
    }]
  });
  expect(Object.keys(bundle.metafile.inputs).some((name) => name.includes('gray-matter'))).toBe(false);
  const context = createContext(Object.create(null) as Record<string, unknown>);
  runInContext(`
    for (const name of ['Buffer', 'process', 'require', 'fetch', 'console']) {
      Object.defineProperty(globalThis, name, { get() { throw new Error('Forbidden global: ' + name); } });
    }
    Date.now = () => { throw new Error('Clock reads are forbidden'); };
  `, context);
  runInContext(bundle.outputFiles[0]!.text, context, { timeout: 5000 });
  const result = runInContext(`(() => {
    const input = (content, filePath) => ({ content, filePath, relativePath: filePath });
    const block = portable.parseBlockFile(input('---\\nid: auth\\n---\\nHello world.', 'block.md'));
    const view = portable.parseViewFile(input('---\\nid: view\\n---\\n@stem[block:auth]', 'view.md'));
    const extended = portable.parseViewFile(input('---\\nid: extended\\n---\\n@stem[block:auth, unused="value"]', 'extended.md'));
    const { graph, issues: buildIssues } = portable.buildGraph([block], [view]);
    const validation = portable.validateGraph({ nowMs: 0, graph, blocks: [block], views: [view], buildIssues,
      schemas: new Map(), cycles: portable.detectCycles(graph), orphanedBlocks: portable.getOrphanedBlocks(graph),
      configuredNamespaces: {}, externalGraphs: new Map() });
    const external = portable.parseViewFile(input('---\\nid: external\\n---\\n@stem[block:other:auth]', 'external.md'));
    const expired = portable.validateGraph({ nowMs: 8 * 86400000, graph, blocks: [block], views: [external], buildIssues: [],
      schemas: new Map(), cycles: [], orphanedBlocks: [], configuredNamespaces: { other: { graphUrl: 'unused' } },
      externalGraphs: new Map([['other', { fetchedAt: '1970-01-01T00:00:00.000Z', isLocalFallback: false,
        graph: { version: '1', namespace: 'other', publishedAt: '', contentSha: '', blocks: [], renames: [] } }]]) });
    const malformed = portable.parseFrontmatter('---\\nid: [broken\\n---\\nBody');
    const unsupported = portable.parseFrontmatter('---\\nvalue: !!binary SGVsbG8=\\n---\\nBody');
    const yaml = portable.parseFrontmatter('---\\nbase: &base {id: merged}\\n<<: *base\\ndate: 2024-01-02\\n---\\nBody');
    const decoded = portable.parseConfigJson('{"blocksDir":"./docs/"}', 'config.json');
    return JSON.stringify({ parserErrors: [...block.errors, ...view.errors, ...extended.errors],
      validation, schemaIssues: portable.validateSchemas([block], new Map()),
      nodes: graph.nodes.size, users: portable.getViewsUsingBlock(graph, 'auth'),
      dependencies: portable.getBlockDependencies(graph, 'auth'), dependents: portable.getBlockDependents(graph, 'auth'),
      legacy: portable.renderViewMarkdown(view, [block]), extended: portable.renderViewMarkdown(extended, [block]),
      expired: expired.map(issue => issue.code), malformed: malformed.errors.map(issue => issue.code),
      unsupported: unsupported.errors.map(issue => issue.code), mergedId: yaml.data.id,
      date: yaml.data.date instanceof Date,
      config: portable.normalizeStemConfig(decoded.data, 'config.json') });
  })()`, context, { timeout: 5000 }) as string;
  expect(JSON.parse(result)).toMatchObject({
    parserErrors: [], validation: [], schemaIssues: [], nodes: 2, users: ['view'], dependencies: [], dependents: [],
    legacy: { success: true, markdown: 'Hello world.' }, extended: { success: true, markdown: 'Hello world.' },
    expired: ['EXPIRED_SNAPSHOT'], malformed: ['INVALID_FRONTMATTER'], unsupported: ['INVALID_FRONTMATTER'],
    mergedId: 'merged', date: true, config: { success: true, data: { blocksDir: 'docs' } }
  });
});
