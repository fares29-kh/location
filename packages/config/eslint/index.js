import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Configuration ESLint (flat config) partagée par tout le monorepo.
 *
 * @param {{ tsconfigRootDir: string; nestApps?: string[]; nextApps?: string[]; reactPackages?: string[] }} options
 */
export function createConfig({
  tsconfigRootDir,
  nestApps = [],
  nextApps = [],
  reactPackages = [],
}) {
  const nestFiles = nestApps.map((dir) => `${dir}/**/*.ts`);
  const nextFiles = nextApps.map((dir) => `${dir}/**/*.{ts,tsx}`);
  const reactFiles = [...nextApps, ...reactPackages].map((dir) => `${dir}/**/*.{ts,tsx}`);

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
    ...(reactFiles.length > 0
      ? [
          {
            files: reactFiles,
            plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
            languageOptions: { globals: { ...globals.browser, ...globals.node } },
            rules: {
              ...reactHooks.configs.recommended.rules,
              ...jsxA11y.flatConfigs.recommended.rules,
              '@typescript-eslint/consistent-type-imports': 'error',
            },
          },
        ]
      : []),
    ...(nextFiles.length > 0
      ? [
          {
            files: nextFiles,
            plugins: { '@next/next': nextPlugin },
            settings: { next: { rootDir: nextApps } },
            rules: {
              ...nextPlugin.configs.recommended.rules,
              ...nextPlugin.configs['core-web-vitals'].rules,
            },
          },
        ]
      : []),
    prettier,
  );
}
