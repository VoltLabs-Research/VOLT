#!/usr/bin/env node

/**
 * Heap-aware startup wrapper for ClusterDaemon.
 *
 * Computes --max-old-space-size dynamically at 80% of the host's total RAM,
 * capped at a reasonable ceiling, and spawns the actual application with that flag.
 * This ensures the V8 heap limit is always proportional to available memory,
 * preventing both OOM kills (limit too high) and premature crashes (limit too low).
 */

'use strict';

const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const HEAP_FRACTION = 0.80;
const MIN_HEAP_MB = 512;
const MAX_HEAP_MB = 16_384; // 16 GB ceiling

const totalMemoryMB = Math.floor(os.totalmem() / (1024 * 1024));
const heapMB = Math.max(MIN_HEAP_MB, Math.min(MAX_HEAP_MB, Math.floor(totalMemoryMB * HEAP_FRACTION)));

const entrypoint = path.resolve(__dirname, '..', 'dist', 'index.js');

console.log(
    `[start] Total RAM: ${totalMemoryMB} MB — setting --max-old-space-size=${heapMB} MB (${Math.round(HEAP_FRACTION * 100)}%)`
);

// Propagate the heap flag through NODE_OPTIONS so that the child process
// (and any sub-processes it spawns) inherit the same limit.
const nodeOptions = process.env.NODE_OPTIONS || '';
const hasHeapFlag = /--max[-_]old[-_]space[-_]size/.test(nodeOptions);

if (!hasHeapFlag) {
    process.env.NODE_OPTIONS = `${nodeOptions} --max-old-space-size=${heapMB}`.trim();
}

// Replace the current process with node running the entrypoint.
// Using execFileSync with stdio: 'inherit' keeps the same PID semantics
// that Docker expects (PID 1 signal forwarding).
try {
    execFileSync(process.execPath, [entrypoint], {
        stdio: 'inherit',
        env: process.env
    });
} catch (err) {
    // execFileSync throws on non-zero exit — propagate the exit code
    process.exit(err.status || 1);
}
