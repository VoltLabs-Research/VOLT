import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

// Minimal, single-purpose ESLint config: it enforces ONE architectural
// invariant plus ONE formatting invariant, and intentionally does NOT impose a
// general lint baseline on the server (which has never had one — adding
// `recommended` would flood pre-existing code with unrelated style errors). The
// only rules here are the object-literal shape below and the detachable-modules
// boundary guard.
export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**'
        ]
    },
    // `base` registers the @typescript-eslint plugin + parser WITHOUT enabling any
    // of the `recommended` style rules — so the only thing this config enforces is
    // the boundary guard below, not a new lint baseline over pre-existing code.
    tseslint.configs.base,
    // Object-literal shape (.agents/conventions.md → Formatting): an object literal
    // with two or more properties is written one property per line, braces on their
    // own lines. Single-property literals may stay inline.
    //
    // `@volt/contracts` is deliberately not linted: ESLint 9 will not lint files
    // outside its config's base path, and the package is 552 type declarations
    // against 29 object literals, so a rule about literal shape would buy almost
    // nothing there. It is typechecked through both consumers, and `.editorconfig`
    // covers the indentation and line endings that actually drift in a
    // declarations-only file.
    {
        files: [
            'src/**/*.ts',
            'tools/**/*.ts',
            'scripts/**/*.ts'
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
    // Detachable-modules invariant (ECOSYSTEM "VOLT Apps"): the neutral `shared/`
    // layer is autoloaded for EVERY deployment, so a VALUE import from `@modules/*`
    // here statically drags that module's code into the runtime and defeats
    // physical module detachment. Type-only imports are erased at compile time and
    // are allowed. Cross-module wiring must go through `@shared/contracts` tokens +
    // domain ports, not concrete module classes.
    {
        files: ['src/shared/**/*.ts'],
        rules: {
            '@typescript-eslint/no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['@modules/*', '@modules/**'],
                        allowTypeImports: true,
                        message: 'shared/ must not value-import from @modules/*. Use `import type`, or wire via @shared/contracts tokens + domain ports.'
                    }
                ]
            }]
        }
    }
);
