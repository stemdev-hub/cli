import { registerHooks } from 'node:module';
import { afterAll } from 'vitest';

// Synchronous hooks intercept createRequire/CommonJS loads of the built bundle.
// Never delegate "vscode" to normal resolution, even if a real module is installed.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === 'vscode' ? { url: 'stem-test:vscode', shortCircuit: true }
      : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url !== 'stem-test:vscode') return nextLoad(url, context);
    return {
      format: 'commonjs', shortCircuit: true,
      source: `
        const fs = require('node:fs/promises');
        module.exports = {
          __stemTestMock: true,
          Uri: { file: fsPath => ({ scheme: 'file', fsPath }) },
          workspace: { fs: { stat: async uri => {
            const stat = await fs.stat(uri.fsPath);
            return { type: stat.isDirectory() ? 2 : 1 };
          } } }
        };
      `
    };
  }
});

afterAll(() => hooks.deregister());
