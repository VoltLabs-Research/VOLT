import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry');

const EXCLUDE = /WindowControls\/index\.tsx$/;

const files = execSync('find src -name "*.tsx" -o -name "*.ts"', { encoding: 'utf8' })
    .trim().split('\n').filter((f) => f && !EXCLUDE.test(f));

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
