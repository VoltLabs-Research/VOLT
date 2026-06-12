import tseslint from 'typescript-eslint';

// Minimal, single-purpose ESLint config: it enforces ONE architectural
// invariant and intentionally does NOT impose a general lint baseline on the
// server (which has never had one — adding `recommended` would flood
// pre-existing code with unrelated style errors). The only rule here is the
// detachable-modules boundary guard below.
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
