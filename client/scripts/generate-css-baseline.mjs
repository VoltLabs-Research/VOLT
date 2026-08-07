/**
 * Regenerates the legacy per-component CSS baseline consumed by eslint.config.js.
 *
 * The boundary rule forbids app-local `.css` imports outside `src/app/**`, which
 * is where the global sheets are wired. The files listed in the baseline predate
 * the rule and are exempted so the repo lints clean today; the point is that the
 * list can only ever shrink. Migrating a component to bravais style props and
 * deleting its stylesheet drops it from this file on the next run.
 *
 *   node scripts/generate-css-baseline.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const OUTPUT = join(ROOT, 'eslint.css-baseline.js');

/*
 * Mirrors the rule's regex: app-local sheets only, never package stylesheets.
 *
 * The leading `(?:^|[\n;])` rather than a `^` with the `m` flag is deliberate —
 * a second import sharing a line with the first (`...from 'react';import './x.css'`)
 * is invisible to a line-anchored pattern, and a file missed here lints as a
 * fresh violation instead of as the legacy it is.
 */
const LOCAL_CSS_IMPORT = /(?:^|[\n;])\s*import\s+(?:[^'"\n]*\s+from\s+)?['"](?:\.{1,2}\/|@\/)[^'"]*\.css(?:\?[^'"]*)?['"]/;

const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map((entry) => {
        const path = join(dir, entry.name);
        if(entry.isDirectory()) return walk(path);
        return /\.tsx?$/.test(entry.name) ? [path] : [];
    }));
    return files.flat();
};

const offenders = [];
for(const path of await walk(SRC)){
    const rel = relative(ROOT, path).split(sep).join('/');
    if(rel.startsWith('src/app/')) continue;
    if(LOCAL_CSS_IMPORT.test(await readFile(path, 'utf8'))) offenders.push(rel);
}
offenders.sort();

await writeFile(OUTPUT, `/**
 * Legacy per-component CSS imports, exempted from the boundary rule in
 * eslint.config.js. Generated — do not hand-edit.
 *
 *   node scripts/generate-css-baseline.mjs
 *
 * This list is a ratchet: it may shrink, never grow. A new entry means a new
 * component styled with a stylesheet instead of bravais style props.
 */

/** @type {string[]} */
export const cssBaseline = [
${offenders.map((file) => `    '${file}'`).join(',\n')}
];

export default cssBaseline;
`, 'utf8');

console.log(`baseline: ${offenders.length} files`);
