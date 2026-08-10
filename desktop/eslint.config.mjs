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
    },
    /*
     * The design-system boundary, matching the client's — now fully closed.
     *
     * The four per-component sheets this rule used to grandfather in (Titlebar,
     * DockerGate, Onboarding, DevModeModal) are gone: their rules are HeroUI
     * components and Tailwind utilities on the elements. `main.tsx` is the only
     * remaining exemption because it wires the one app-level sheet,
     * `src/renderer/src/styles.css`, which holds the HeroUI token rebase and the
     * frameless-window chrome that lands on `html`/`body`/`#root` — elements no
     * `className` can reach.
     */
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
