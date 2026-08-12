
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(readFileSync(join(here, 'utility-class-map.json'), 'utf8'));
const dryRun = process.argv.includes('--dry');

const EXCLUDE = /(buildBoxClasses|typography|types)\.ts$/;

const files = execSync('find src -name "*.tsx" -o -name "*.ts"').toString().trim()
    .split('\n').filter((f) => !EXCLUDE.test(f));

const retired = Object.keys(map).filter((k) => map[k] !== k);
const sample = files.map((f) => readFileSync(f, 'utf8')).join('\n');
const remaining = retired.filter((c) => new RegExp(`['"\`\\s]${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`\\s]`).test(sample)).length;
if(remaining < 5){
    console.error(`Refusing to run: only ${remaining} retired class names found. This tree looks already migrated.`);
    process.exit(1);
}

let changedFiles = 0, changedTokens = 0;
const perClass = new Map();

for(const file of files){
    const src = readFileSync(file, 'utf8');
    let touched = 0;

    const out = src.replace(/(['"`])([^'"`\n]*)\1/g, (whole, quote, body) => {
        if(!body || !/[a-z]/.test(body)) return whole;
        let hit = false;
        const mapped = body.split(/(\s+)/).map((part) => {
            if(!(part in map) || map[part] === part) return part;
            hit = true; touched++;
            perClass.set(part, (perClass.get(part) ?? 0) + 1);
            return map[part];
        });
        return hit ? quote + mapped.join('') + quote : whole;
    });

    if(touched){
        changedFiles++; changedTokens += touched;
        if(!dryRun) writeFileSync(file, out);
    }
}

console.log(`${dryRun ? '[dry run] ' : ''}${changedTokens} tokens across ${changedFiles} files`);
[...perClass].sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}x  ${k}  ->  ${map[k]}`));

console.log(`
Afterwards, by hand:
  - grep for token-valued props the rewrite cannot see: direction=, overflow=,
    height=, width=. Their values ('row', 'column', 'y-auto', 'vh-max') are
    token names that collide with class names.
  - the composites bravais still ships keep their names and need no change:
    text-eyebrow, transition-fast/normal, list-item-hoverable, center-x,
    screen-vh, scrollbar-none, panel-header/footer-bordered, shadow-*,
    volt-divider, grid-auto-fit/fill, table-scroll-wrapper.`);
