import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { cssBaseline } from './eslint.css-baseline.js';

/**
 * Matches an app-local stylesheet import — relative or `@/`-aliased — and not a
 * package one, so `bravais/styles.css` and `sileo/styles.css` stay reachable.
 */
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
            '@typescript-eslint/no-empty-object-type': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
                ignoreRestSiblings: true,
                varsIgnorePattern: '^_'
            }],
            // An empty block is allowed only with a comment explaining the
            // deliberate swallow, so an accidental one fails the build.
            'no-empty': 'error',
            'no-unsafe-finally': 'error',
            'prefer-const': 'warn',
            // A hook called out of order corrupts React's internal state: this is
            // never a stylistic warning.
            'react-hooks/rules-of-hooks': 'error',
            'react-refresh/only-export-components': 'off'
        }
    },
    /*
     * The design-system boundary.
     *
     * 58% of this app's CSS declarations were layout and typography that bravais
     * style props already express, which is how 204 stylesheets accumulated next
     * to a design system that had the vocabulary all along. Closing the escape
     * hatch is what keeps that from happening again: a component reaches for
     * bravais, and anything genuinely missing gets added there once.
     *
     * `cssBaseline` exempts the components that predate the rule. It is a
     * ratchet — regenerate with `node scripts/generate-css-baseline.mjs` after
     * migrating a component, and the list shrinks.
     */
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
