import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { cssBaseline } from './eslint.css-baseline.js';
import { classNameBaseline } from './eslint.classname-baseline.js';
import { overflowBaseline } from './eslint.overflow-baseline.js';

const LOCAL_CSS_IMPORT = '^(\\.{1,2}/|@/).*\\.css(\\?.*)?$';

// HeroUI's scale (--radius: 0.5rem), by role. Kept in sync with the radius roles in the port contract.
const RADIUS_ROLES = [
    'Use the radius roles: rounded-sm 4px (tiny inline marks: kbd, inline code, swatches, chart cells),',
    'rounded-md 6px (dense controls: 28px icon buttons, sidebar nav rows, status badges, skeleton lines),',
    'rounded-lg 8px (rows inside a surface: list, tree and context-menu rows; 36px icon buttons),',
    'rounded-xl 12px (tiles and blocks inside a section, tooltips, context menus, segmented controls),',
    'rounded-2xl 16px (sections, cards, the chrome surface, toasts, floating panels, table frames),',
    'rounded-3xl 24px (covers, dialogs, popovers, detail panels),',
    'rounded-full (pills: buttons, chips, search fields, avatars, dots, progress tracks).',
    'An inner radius is concentric with its container (outer radius minus padding), or a pill when the row is short.'
].join(' ');

const BANNED_CLASS_PATTERNS = [
    [
        'text-\\u005B\\d',
        'Arbitrary font sizes are closed. Use the type scale: text-2xs (11px meta, the floor), text-xs (12px labels), text-sm (13px body), text-base (14px prose), lg+ for titles.'
    ],
    [
        'font-\\u005B\\d',
        'Arbitrary font weights are closed. Use font-normal (body), font-medium (emphasis/labels), font-semibold (section and page headings).'
    ],
    [
        'rounded(-(tl|tr|bl|br|ss|se|es|ee|t|b|l|r|s|e))?-\\u005B\\d',
        `Arbitrary radii are closed. ${RADIUS_ROLES}`
    ],
    [
        'rounded(-(tl|tr|bl|br|ss|se|es|ee|t|b|l|r|s|e))?-(xs|4xl)(\\s|$)',
        `rounded-xs and rounded-4xl have no role. ${RADIUS_ROLES}`
    ],
    [
        '(^|\\s|:)-?(px|py|pt|pb|pl|pr|p|mx|my|mt|mb|ml|mr|m|gap-x|gap-y|gap|space-x|space-y)-\\u005B\\d',
        'Arbitrary spacing is closed. Spacing sits on the 4px grid: use the numeric steps (0.5 = 2px, 1 = 4px, 1.5 = 6px, 2 = 8px, ...). Dynamic var()/calc()/env() values stay allowed.'
    ],
    [
        '\\u005B#\\w\\w\\w',
        'Hex colors in class names are closed. Use the semantic tokens (text-success-soft-foreground, bg-info-soft, ...) defined in index.css so both themes stay coherent.'
    ]
];

const classNameRatchet = BANNED_CLASS_PATTERNS.flatMap(([pattern, message]) => [
    { selector: `Literal[value=/${pattern}/]`, message },
    { selector: `TemplateElement[value.raw=/${pattern}/]`, message }
]);

const BANNED_OVERFLOW_PATTERN = 'overflow-(x-|y-)?(auto|scroll)(?!ing)';
const OVERFLOW_MESSAGE = [
    'Scrolling containers are closed. Use shared/ui/components/Scrollable (orientation="horizontal"',
    'for sideways scrollers) so the region gets an edge fade: scrollbars are hidden app-wide, so',
    'without it a clipped list gives the reader no sign that content continues.',
    'overflow-hidden and overflow-*-clip stay available — they do not scroll.'
].join(' ');

const overflowRatchet = [
    { selector: `Literal[value=/${BANNED_OVERFLOW_PATTERN}/]`, message: OVERFLOW_MESSAGE },
    { selector: `TemplateElement[value.raw=/${BANNED_OVERFLOW_PATTERN}/]`, message: OVERFLOW_MESSAGE }
];

const LAYER_SERVICE_MESSAGE = [
    'Components must not call api services directly. Go through the module data layer',
    '(hooks/<area>/queries.ts) so caching, access mode and error handling stay in one place.',
    'Type-only imports of request/response shapes are allowed.'
].join(' ');

const LAYER_COMPONENT_MESSAGE = [
    'hooks/ and store/ must not depend on components/. Move the shared value into',
    'contracts/ (ids, payload shapes, enums). Type-only imports are allowed.'
].join(' ');

const CSS_BOUNDARY_MESSAGE = [
    'Per-component stylesheets are closed. Style with HeroUI components and their variants and with',
    'Tailwind utilities on the tokens in src/shared/ui/assets/stylesheets/index.css instead of a .css file.',
    'A rule Tailwind cannot express goes in that index.css; global sheets are wired in src/app/.'
].join(' ');

const cssImportPattern = {
    regex: LOCAL_CSS_IMPORT,
    message: CSS_BOUNDARY_MESSAGE
};

const serviceLayerPattern = {
    group: ['**/api/service', '**/api/service/**', '**/api/services/**'],
    allowTypeImports: true,
    message: LAYER_SERVICE_MESSAGE
};

const componentLayerPattern = {
    group: ['**/components/**'],
    allowTypeImports: true,
    message: LAYER_COMPONENT_MESSAGE
};

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'dist-mockup/**',
            'node_modules/**',
            'coverage/**'
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
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
                patterns: [cssImportPattern]
            }]
        }
    },
    {
        files: ['src/modules/*/components/**/*.tsx'],
        ignores: ['**/use-*.tsx', ...cssBaseline],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [cssImportPattern, serviceLayerPattern]
            }]
        }
    },
    {
        files: cssBaseline.filter((file) => /^src\/modules\/[^/]+\/components\/.*\.tsx$/.test(file)),
        ignores: ['**/use-*.tsx'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [serviceLayerPattern]
            }]
        }
    },
    {
        files: ['src/**/hooks/**/*.{ts,tsx}', 'src/**/store/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [cssImportPattern, componentLayerPattern]
            }]
        }
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: [...classNameBaseline, ...overflowBaseline],
        rules: {
            'no-restricted-syntax': ['error', ...classNameRatchet, ...overflowRatchet]
        }
    },
    {
        files: [...overflowBaseline],
        rules: {
            'no-restricted-syntax': ['error', ...classNameRatchet]
        }
    },
    {
        files: [...classNameBaseline],
        rules: {
            'no-restricted-syntax': ['error', ...overflowRatchet]
        }
    }
);
