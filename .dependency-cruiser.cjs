'use strict';

const KERNEL_MODULES = ['system', 'container'];

module.exports = {
    forbidden: [
        {
            name: 'no-cross-module-imports',
            comment:
                'A module may only import from its own folder, from kernel modules '
                + `(${KERNEL_MODULES.join(', ')}) or from @shared/**. Route anything else `
                + 'through src/shared/contracts so modules stay physically detachable. '
                + 'Known debt: warn until the existing edges are routed through ports, '
                + 'then promote to error.',
            severity: 'warn',
            from: { path: '^src/modules/([^/]+)/' },
            to: {
                path: '^src/modules/([^/]+)/',
                pathNot: `^src/modules/(\\1|${KERNEL_MODULES.join('|')})/`
            }
        },
        {
            name: 'no-shared-to-modules',
            comment:
                'src/shared/** must not depend on a concrete module. The only tolerated '
                + 'seam is a type-only import of a module event or model type.',
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
            comment:
                'Known debt: the workflow NodeRegistry and its node handlers still form '
                + 'a cycle, resolved lazily at runtime by getWorkflowNodeRegistry().',
            severity: 'warn',
            from: {},
            to: { circular: true }
        },
        {
            name: 'no-orphans',
            comment: 'Files nothing imports and that import nothing are dead weight.',
            severity: 'info',
            from: {
                orphan: true,
                pathNot: [
                    '\\.d\\.ts$',
                    'tsconfig[^/]*\\.json$'
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
};
