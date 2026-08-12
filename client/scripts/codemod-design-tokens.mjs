
/*
 * One-shot migration of arbitrary utility values to the closed design-token
 * scale defined in src/shared/ui/assets/stylesheets/index.css.
 *
 * Most of the arbitrary values this removes were fallout from the earlier
 * bravais -> Tailwind migration (utility-class-map.json mapped the old
 * fractional scale to literal brackets, e.g. gap-035 -> gap-[0.35rem]).
 * Values are snapped to the nearest step; ties round down (denser).
 *
 * Run with --dry to preview. The className ratchet in eslint.config.js
 * keeps the tree clean after this runs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry');

// macOS window-chrome mimicry: intentionally off-scale, kept in the ratchet baseline.
const EXCLUDE = /WindowControls\/index\.tsx$/;

const files = execSync('find src -name "*.tsx" -o -name "*.ts"', { encoding: 'utf8' })
    .trim().split('\n').filter((f) => f && !EXCLUDE.test(f));

// text-[VALUE] -> role on the closed scale. 11px (2xs) is the floor:
// everything below it maps up, never to a smaller size.
const TEXT_SIZE = {
    '0.55rem': '2xs', '0.58rem': '2xs', '9px': '2xs', '0.6rem': '2xs', '0.62rem': '2xs',
    '10px': '2xs', '0.625rem': '2xs', '0.65rem': '2xs', '0.68rem': '2xs',
    '0.6875rem': '2xs', '11px': '2xs', '0.7rem': '2xs', '0.7125rem': '2xs',
    '0.72rem': 'xs', '0.74rem': 'xs', '0.75rem': 'xs', '0.78rem': 'xs', '12px': 'xs',
    '0.8rem': 'sm', '0.8125rem': 'sm', '13px': 'sm',
    '0.85rem': 'base', '0.875rem': 'base', '0.9rem': 'base', '0.9375rem': 'base',
    '0.95rem': 'base', '14px': 'base',
    '1.125rem': 'lg', '1.15rem': 'lg', '18px': 'lg',
    '1.75rem': '2xl',
    '1.8rem': '3xl', '2rem': '3xl'
};

// spacing-[VALUE] -> 4px-grid step (rem * 16, nearest step, ties down).
const SPACING = {
    '0.05rem': 'px', '0.1rem': '0.5', '0.15rem': '0.5', '0.1875rem': '0.5',
    '0.2rem': '1', '0.25rem': '1', '0.3rem': '1',
    '0.35rem': '1.5', '0.375rem': '1.5', '0.4rem': '1.5', '0.4375rem': '1.5',
    '0.45rem': '2', '0.5rem': '2', '0.55rem': '2',
    '0.6rem': '2.5', '0.65rem': '2.5',
    '0.7rem': '3', '0.75rem': '3', '0.8rem': '3',
    '0.85rem': '3.5', '0.95rem': '4',
    '1px': 'px', '2px': '0.5', '3px': '0.5', '5px': '1',
    '7px': '1.5', '11px': '2.5', '18px': '4',
    '1.1rem': '4', '1.2rem': '5'
};

const SPACING_PREFIX = '(?:px|py|pt|pb|pl|pr|p|mx|my|mt|mb|ml|mr|m|gap-x|gap-y|gap|space-x|space-y|top|right|bottom|left|inset-x|inset-y|inset)';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rules = [];

for(const [value, token] of Object.entries(TEXT_SIZE)){
    rules.push([`text-${value}`, new RegExp(`text-\\[${escape(value)}\\]`, 'g'), `text-${token}`]);
}
for(const [value, step] of Object.entries(SPACING)){
    rules.push([
        `spacing-${value}`,
        new RegExp(`(?<![\\w-])(-?${SPACING_PREFIX})-\\[${escape(value)}\\]`, 'g'),
        `$1-${step}`
    ]);
}

const DIR = '(-(?:tl|tr|bl|br|ss|se|es|ee|t|b|l|r|s|e))?';
rules.push(
    ['rounded-2xl/3xl', new RegExp(`rounded${DIR}-(?:2xl|3xl)(?![\\w-])`, 'g'), 'rounded$1-xl'],
    ['rounded-[overlay]', new RegExp(`rounded${DIR}-\\[(?:10px|0\\.625rem|14px|0\\.95rem|1\\.25rem)\\]`, 'g'), 'rounded$1-xl'],
    ['rounded-[control]', new RegExp(`rounded${DIR}-\\[0\\.35rem\\]`, 'g'), 'rounded$1-md'],
    ['rounded-[tiny]', new RegExp(`rounded${DIR}-\\[(?:2px|3px|4px|0\\.3rem)\\]`, 'g'), 'rounded$1-sm'],
    ['rounded-xs', /rounded-xs(?![\w-])/g, 'rounded-sm'],
    ['font-[550]', /font-\[550\]/g, 'font-medium'],
    ['font-[650]', /font-\[650\]/g, 'font-semibold'],
    ['font-bold', /font-bold(?![\w-])/g, 'font-semibold']
);

// Hand-picked light-theme status hexes -> the *-soft-foreground tokens
// (one color-mix formula per tone, defined in index.css for both themes).
const HEX_TO_TONE = { '0a5fbf': 'info', '8a5300': 'warning', '0f7a34': 'success', 'c41e1e': 'danger' };
const LIGHT_OVERRIDE = /\s*\[\[data-theme=light\]_&\]:(?:\[&>\.truncate\]:)?text-\[#([0-9a-f]{6})\]/;

const retoneLine = (line) => {
    const match = line.match(LIGHT_OVERRIDE);
    if(!match) return line;
    const tone = HEX_TO_TONE[match[1]];
    if(!tone) return line;
    const stripped = line.replace(LIGHT_OVERRIDE, '');
    const retoned = stripped.replace(
        /((?:\[&>\.truncate\]:)?)text-(?:accent|info|success|warning|danger)(?![\w-])/,
        `$1text-${tone}-soft-foreground`
    );
    return retoneLine(retoned);
};

// Bare `rounded` (4px) -> rounded-sm, only on className lines so that
// non-class strings like skeleton variant names stay untouched.
const bareRounded = (line) => (
    line.includes('className')
        ? line.replace(/(?<=[\s'"`])rounded(?=\s)/g, 'rounded-sm')
        : line
);

let changedFiles = 0;
const perRule = new Map();

for(const file of files){
    const src = readFileSync(file, 'utf8');
    let out = src;

    for(const [name, regex, replacement] of rules){
        const hits = out.match(regex);
        if(!hits) continue;
        perRule.set(name, (perRule.get(name) ?? 0) + hits.length);
        out = out.replace(regex, replacement);
    }

    if(out.includes('[[data-theme=light]_&]') || /(?<=[\s'"`])rounded(?=\s)/.test(out)){
        out = out.split('\n').map((line) => bareRounded(retoneLine(line))).join('\n');
    }

    if(out !== src){
        changedFiles++;
        if(!dryRun) writeFileSync(file, out);
    }
}

console.log(`${dryRun ? '[dry run] ' : ''}${changedFiles} files changed`);
[...perRule].sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => console.log(`  ${String(count).padStart(4)}x  ${name}`));
