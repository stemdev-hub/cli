import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  external: ['@stemdev/core'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
    },
  },
  clean: true,
});
