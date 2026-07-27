import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'

export default [
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'Somique Beauty Design System/**'],
  },
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        {
          'ts-ignore': 'allow-with-description',
          'ts-expect-error': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
        },
      ],
      '@typescript-eslint/triple-slash-reference': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Native browser dialogs are banned app-wide: use `useConfirm()`
      // (src/components/ConfirmDialogProvider.tsx) and `toast.*()` from sonner.
      'no-alert': 'error',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
]