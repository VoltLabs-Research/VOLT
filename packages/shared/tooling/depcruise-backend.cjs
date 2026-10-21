'use strict';

// Layering rules for a backend laid out as src/{core,modules,shared}. Kernel modules are the
// ones every other module may import. circularDebt describes the import cycles still tolerated;
// without it any cycle is an error.
module.exports = ({ kernelModules, circularDebt }) => ({
    forbidden: [
        {
            name: 'no-cross-module-imports',
            comment:
                'A module may only import from its own folder, from kernel modules '
                + `(${kernelModules.join(', ')}) or from @shared/**. Route anything else `
                + 'through src/shared/contracts so modules stay physically detachable. '
                + 'Known debt: warn until the existing edges are routed through ports, '
                + 'then promote to error.',
            severity: 'warn',
            from: { path: '^src/modules/([^/]+)/' },
            to: {
                path: '^src/modules/([^/]+)/',
                pathNot: `^src/modules/($1|${kernelModules.join('|')})/`
            }
        },
        {
            name: 'no-shared-to-modules',
            comment:
                'src/shared/** must not depend on a concrete module. The only tolerated '
                + 'seam is a type-only import of a module event class or model type, which '
                + 'eslint (no-restricted-imports, allowTypeImports) keeps type-only.',
            severity: 'error',
            from: { path: '^src/shared/' },
            to: {
                path: '^src/modules/',
                pathNot: '^src/modules/[^/]+/(events|models)/'
            }
        },
        {
            name: 'no-core-to-modules-except-bootstrap',
            comment:
                'Only src/core/bootstrap/** may reference concrete modules; it is the '
                + 'composition root that mounts them.',
            severity: 'error',
            from: {
                path: '^src/core/',
                pathNot: '^src/core/bootstrap/'
            },
            to: { path: '^src/modules/' }
        },
        {
            name: 'no-circular',
            comment: circularDebt ? `Known debt: ${circularDebt}` : 'Import cycles are not allowed.',
            severity: circularDebt ? 'warn' : 'error',
            from: {},
            to: { circular: true }
        },
        {
            name: 'no-orphans',
            comment:
                'Files nothing imports and that import nothing are dead weight. '
                + 'Informational only: type-only importers are invisible to this run.',
            severity: 'info',
            from: {
                orphan: true,
                pathNot: [
                    '\\.d\\.ts$',
                    '(^|/)tsconfig[^/]*\\.json$',
                    '(^|/)eslint\\.config\\.mjs$'
                ]
            },
            to: {}
        },
        {
            name: 'not-to-dev-dep',
            severity: 'error',
            from: {
                path: '^src/',
                pathNot: '\\.(test|spec)\\.ts$'
            },
            to: { dependencyTypes: ['npm-dev'] }
        }
    ],
    options: {
        doNotFollow: { path: 'node_modules' },
        exclude: { path: '(^|/)dist/' },
        tsConfig: { fileName: 'tsconfig.json' },
        enhancedResolveOptions: {
            extensions: ['.ts', '.d.ts', '.js', '.json', '.mjs', '.cjs'],
            exportsFields: ['exports'],
            conditionNames: ['require', 'node', 'import']
        },
        reporterOptions: {
            text: { highlightFocused: true }
        }
    }
});
