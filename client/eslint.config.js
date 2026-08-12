import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { cssBaseline } from './eslint.css-baseline.js';

const LOCAL_CSS_IMPORT = '^(\\.{1,2}/|@/).*\\.css(\\?.*)?$';

const CSS_BOUNDARY_MESSAGE = [
    'Per-component stylesheets are closed. Layout and typography belong to bravais:',
    'use Box/Stack/Row/Grid style props (display, direction, align, justify, gap, p, radius, border, overflow)',
    'and Text/Heading (size, tone, weight) instead of a .css file.',
    'Global sheets are wired in src/app/, and shared visual language belongs in bravais itself.'
].join(' ');

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**'
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: { ...globals.node }
        }
    },
    reactHooks.configs['recommended-latest'],
    reactRefresh.configs.vite,
    {
        files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: {
                ...globals.browser,
                ...globals.es2022,
                ...globals.node
            },
            parserOptions: {}
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-object-type': ['warn', { allowInterfaces: 'with-single-extends' }],
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
                ignoreRestSiblings: true,
                varsIgnorePattern: '^_'
            }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unsafe-finally': 'error',
            'prefer-const': 'warn',
            'react-hooks/rules-of-hooks': 'error',
            'react-refresh/only-export-components': 'off'
        }
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/app/**', ...cssBaseline],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [{
                    regex: LOCAL_CSS_IMPORT,
                    message: CSS_BOUNDARY_MESSAGE
                }]
            }]
        }
    }
);
