import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    // Overrides live in the same block as the plugins they configure: a block
    // without `files` also matches .js files, where these plugins are not loaded.
    rules: {
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // shadcn components are CLI-generated and export their cva variants (buttonVariants, …)
    // next to the component by design; don't hand-edit them to satisfy this rule.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]);
