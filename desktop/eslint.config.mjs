import stylistic from '@stylistic/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Same shape as the server and daemon configs: minimal and single-purpose. It
// enforces the ONE formatting invariant from conventions.md plus the process
// boundary that keeps the Electron sandbox meaningful, and deliberately does NOT
// enable a `recommended` baseline over pre-existing code.
export default tseslint.config(
    {
        ignores: [
            'out/**',
            'dist/**',
            'node_modules/**'
        ]
    },
    tseslint.configs.base,
    /*
     * The renderer is React, and until now nothing checked its hooks. A hook called
     * out of order corrupts React's internal state, so `rules-of-hooks` is an error;
     * `exhaustive-deps` stays a warning because it has actionable false positives.
     */
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
    // Object-literal shape (conventions.md → Formatting).
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
    /*
     * Process boundary. The renderer runs with `contextIsolation: true` and
     * `nodeIntegration: false`, and it navigates to the VOLT client — which with
     * `remote.connect` can be any endpoint the user names. Reaching `electron` or
     * `node:*` from renderer code would either fail at runtime or, worse, only work
     * because someone weakened those settings. Everything the renderer needs is on
     * the `window.volt` bridge that `preload.ts` exposes.
     *
     * `@/services/*` and `@/types/*` are still importable for their *types*; only
     * value imports of the runtime modules are blocked.
     */
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
    }
);
