#!/usr/bin/env node
// Checks the layering of the backend in the current directory: fails on any error-severity
// dependency rule, and on any growth of the warn-severity debt pinned in depcruise-baseline.json.
// --update pins the current debt as the new baseline.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The package exports only its API (src/main/index.mjs), so its CLI is found from there.
const cruiserRoot = path.resolve(path.dirname(fileURLToPath(import.meta.resolve('dependency-cruiser'))), '..', '..');
const depcruise = path.join(cruiserRoot, 'bin', 'dependency-cruise.mjs');

const baselinePath = path.resolve('depcruise-baseline.json');

const run = spawnSync(process.execPath, [
    depcruise, 'src/**/*.ts', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'
], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

if (!run.stdout) {
    console.error(run.stderr || 'dependency-cruiser produced no output');
    process.exit(1);
}

const report = JSON.parse(run.stdout);

const errors = report.summary.violations.filter((violation) => violation.rule.severity === 'error');
for (const violation of errors) {
    console.error(`${violation.rule.name}: ${violation.from} -> ${violation.to}`);
}

// Debt is counted per offending import, so adding an edge to an existing cycle also counts.
const counts = {};
for (const module_ of report.modules) {
    for (const dependency of module_.dependencies) {
        for (const rule of dependency.rules ?? []) {
            if (rule.severity === 'warn') {
                counts[rule.name] = (counts[rule.name] ?? 0) + 1;
            }
        }
    }
}
const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

if (errors.length > 0) {
    console.error(`\n${errors.length} layering rule violation(s).`);
    process.exit(1);
}

if (process.argv.includes('--update')) {
    writeFileSync(baselinePath, `${JSON.stringify({ total, counts }, null, 4)}\n`);
    console.log(`Baseline updated: ${total} ${JSON.stringify(counts)}`);
    process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
console.log(`Layering debt: ${total} (baseline ${baseline.total}) ${JSON.stringify(counts)}`);

if (total > baseline.total) {
    console.error(`\nLayering debt grew from ${baseline.total} to ${total}. Route the new edge through @shared/contracts instead.`);
    process.exit(1);
}

if (total < baseline.total) {
    console.log('Layering debt dropped; run `pnpm run layering:update` to pin the new baseline.');
}
