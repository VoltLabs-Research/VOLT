#!/usr/bin/env node
/**
 * Dependency-boundary ratchet.
 *
 * The dependency-cruiser rules are all `warn`, so nothing fails when a new
 * cross-module import or cycle lands — which is how the count grew to hundreds
 * with no one noticing. This pins the current total in `depcruise-baseline.json`
 * (same pattern as the client's CSS baseline): the number may shrink, never grow.
 * When you remove violations, re-run with `--update` to lower the ceiling.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'scripts', 'depcruise-baseline.json');

const output = execFileSync('npx', [
    '--yes', 'dependency-cruiser@^17.4.3',
    'src/**/*.ts', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'
], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const report = JSON.parse(output);
const counts = {};
for (const module_ of report.modules) {
    for (const dependency of module_.dependencies) {
        for (const rule of dependency.rules ?? []) {
            counts[rule.name] = (counts[rule.name] ?? 0) + 1;
        }
    }
}

const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

if (process.argv.includes('--update')) {
    writeFileSync(baselinePath, `${JSON.stringify({ total, counts }, null, 4)}\n`);
    console.log(`baseline actualizado: total=${total} ${JSON.stringify(counts)}`);
    process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
console.log(`violaciones: ${total} (baseline ${baseline.total}) ${JSON.stringify(counts)}`);

if (total > baseline.total) {
    console.error(`\nRATCHET: las violaciones de frontera subieron de ${baseline.total} a ${total}.`);
    console.error('No agregues imports cross-module nuevos; si eliminaste otros, corre con --update.');
    process.exit(1);
}

if (total < baseline.total) {
    console.log('Bajaron — corre `node scripts/check-depcruise-ratchet.mjs --update` para fijar el nuevo techo.');
}
