import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', {
        globals: ['process', 'Buffer', 'require', 'fetch', 'console', 'performance'],
        checkGlobalObject: true
      }],
      'no-restricted-syntax': ['error',
        {
          selector: 'CallExpression[callee.type="MemberExpression"][callee.object.name="Date"][callee.property.name="now"], CallExpression[callee.type="MemberExpression"][callee.object.name="Date"][callee.property.value="now"]',
          message: 'Core must receive time as nowMs; Date.now() reads the clock.'
        },
        {
          selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
          message: 'Core must receive time as nowMs; new Date() reads the clock.'
        },
        {
          selector: 'ImportExpression',
          message: 'Core must use static imports; dynamic import() is forbidden.'
        }
      ]
    }
  },
  {
    files: ['.dependency-cruiser.cjs', 'scripts/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' }
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },
  {
    files: ['.dependency-cruiser.cjs'],
    languageOptions: { sourceType: 'commonjs' }
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.stem/cache/**',
      '.temp/**',
      'eslint.config.js',
      'packages/cli/tests/smoke/*.mjs',
      'packages/vscode-stem/extension.js'
    ]
  }
);
