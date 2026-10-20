import stylistic from '@stylistic/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'out/**',
            'dist/**',
            'node_modules/**'
        ]
    },
    tseslint.configs.base,
    {
        files: [
            'src/renderer/**/*.ts',
            'src/renderer/**/*.tsx'
        ],
        plugins: {
            'react-hooks': reactHooks
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn'
        }
    },
    {
        files: [
            'src/**/*.ts',
            'src/**/*.tsx'
        ],
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            '@stylistic/object-curly-newline': ['error', {
                ObjectExpression: {
                    multiline: true,
                    minProperties: 2,
                    consistent: true
                }
            }]
        }
    },
    {
        files: [
            'src/renderer/**/*.ts',
            'src/renderer/**/*.tsx'
        ],
        rules: {
            '@typescript-eslint/no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['electron', 'electron/*'],
                        allowTypeImports: true,
                        message: 'The renderer must not import electron. Use the window.volt bridge exposed by preload.ts.'
                    },
                    {
                        group: ['node:*'],
                        allowTypeImports: true,
                        message: 'The renderer has no Node integration. Move this to the main process and expose it over IPC.'
                    }
                ]
            }]
        }
    },
    {
        files: ['src/renderer/**/*.{ts,tsx}'],
        ignores: ['src/renderer/src/main.tsx'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [{
                    regex: '^(\\.{1,2}/|@/).*\\.css(\\?.*)?$',
                    message: 'Per-component stylesheets are closed. Express it as Tailwind utilities on the element, or as a HeroUI component prop; the one app-level sheet is wired in src/renderer/src/main.tsx.'
                }]
            }]
        }
    }
);
