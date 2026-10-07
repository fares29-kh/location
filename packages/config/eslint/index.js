import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Configuration ESLint (flat config) partagée par tout le monorepo.
 *
 * @param {{ tsconfigRootDir: string; nestApps?: string[]; nextApps?: string[] }} options
 */
export function createConfig({ tsconfigRootDir, nestApps = [], nextApps = [] }) {
  const nestFiles = nestApps.map((dir) => `${dir}/**/*.ts`);
  const nextFiles = nextApps.map((dir) => `${dir}/**/*.{ts,tsx}`);

  return defineConfig(
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/dist-worker/**',
        '**/.next/**',
        '**/coverage/**',
        '**/next-env.d.ts',
        '**/prisma/migrations/**',
      ],
    },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        'no-console': 'error',
        eqeqeq: ['error', 'always'],
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: { globals: globals.node },
    },
    ...(nestFiles.length > 0
      ? [
          {
            files: nestFiles,
            languageOptions: { globals: globals.node },
            rules: {
              '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
            },
          },
        ]
      : []),
    ...(nextFiles.length > 0
      ? [
          {
            files: nextFiles,
            plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
            languageOptions: { globals: { ...globals.browser, ...globals.node } },
            settings: { next: { rootDir: nextApps } },
            rules: {
              ...nextPlugin.configs.recommended.rules,
              ...nextPlugin.configs['core-web-vitals'].rules,
              ...reactHooks.configs.recommended.rules,
              '@typescript-eslint/consistent-type-imports': 'error',
            },
          },
        ]
      : []),
    prettier,
  );
}
