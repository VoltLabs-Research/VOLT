import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

// Mirrors the server's config on purpose: minimal and single-purpose. It enforces
// the ONE formatting invariant from conventions.md plus the detachable-modules
// boundary, and deliberately does NOT enable a `recommended` baseline, which would
// flood 32k lines of pre-existing code with unrelated style errors.
export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '.runtime/**'
        ]
    },
    // Registers the @typescript-eslint plugin + parser WITHOUT any `recommended`
    // style rules, so the only things enforced are the two blocks below.
    tseslint.configs.base,
    // Object-literal shape (conventions.md → Formatting): an object literal with two
    // or more properties is written one property per line. Single-property literals
    // may stay inline.
    {
        files: [
            'src/**/*.ts',
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
    // Detachable-modules invariant, the same one `.dependency-cruiser.cjs` states as
    // `no-shared-to-modules`: `shared/` is loaded for every deployment, so a VALUE
    // import from `@modules/*` statically drags that module into the runtime and
    // defeats physical detachment. Type-only imports are erased and are allowed.
    {
        files: ['src/shared/**/*.ts'],
        rules: {
            '@typescript-eslint/no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['@modules/*', '@modules/**'],
                        allowTypeImports: true,
                        message: 'shared/ must not value-import from @modules/*. Use `import type`, or wire via @shared/contracts.'
                    }
                ]
            }]
        }
    }
);
