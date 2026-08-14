import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { cssBaseline } from './eslint.css-baseline.js';
import { classNameBaseline } from './eslint.classname-baseline.js';
import { overflowBaseline } from './eslint.overflow-baseline.js';

const LOCAL_CSS_IMPORT = '^(\\.{1,2}/|@/).*\\.css(\\?.*)?$';

/*
 * className token ratchet. The design scales are closed (see the @theme
 * contract in src/shared/ui/assets/stylesheets/index.css); these patterns
 * ban the escape hatches. Patterns avoid regex character classes because
 * they live inside esquery selectors ([ is a literal "[").
 */
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
        'Arbitrary radii are closed. Use the radius roles: rounded-sm (tiny inline), rounded-md (controls), rounded-lg (surfaces), rounded-xl (overlays).'
    ],
    [
        'rounded(-(tl|tr|bl|br|ss|se|es|ee|t|b|l|r|s|e))?-(xs|2xl|3xl|4xl)(\\s|$)',
        'The radius scale stops at rounded-xl (overlays). rounded-xs was retired for rounded-sm; 2xl+ belongs to HeroUI overlay internals only.'
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

/*
 * Scroll-affordance ratchet. Scrollbars are hidden globally (index.css), so a bare
 * overflow-*-auto container clips its content with no cue that anything continues; the edge fade
 * is the only affordance left. Scrollable owns it.
 *
 * `(?!ing)` keeps `[-webkit-overflow-scrolling:touch]` out of the match. As above, the pattern
 * carries no regex character class because it lives inside an esquery selector, where [ is
 * a literal.
 */
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
                patterns: [{
                    regex: LOCAL_CSS_IMPORT,
                    message: CSS_BOUNDARY_MESSAGE
                }]
            }]
        }
    },
    /*
     * Both ratchets ride the same rule key, so they cannot be two plain blocks: in flat config a
     * later block that sets `no-restricted-syntax` replaces the earlier one for the files it
     * matches, which would silently switch the first ratchet off. Instead the shared case bans
     * both, and each baseline gets a block that re-applies the ratchet it is *not* exempt from.
     */
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
