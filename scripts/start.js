#!/usr/bin/env node

/**
 * Heap-aware startup wrapper for ClusterDaemon.
 *
 * Computes --max-old-space-size dynamically at 80% of the available memory,
 * capped at a reasonable ceiling, and spawns the actual application with that flag.
 *
 * In containerised environments (Docker / cgroup v2) `process.constrainedMemory()`
 * returns the cgroup memory limit rather than the host's total RAM — preventing the
 * daemon from sizing its heap beyond the container budget and getting OOM-killed.
 * Falls back to `os.totalmem()` when running outside a cgroup.
 *
 * `--expose-gc` is injected so that the memory monitor can trigger manual GC cycles
 * when heap pressure is detected (see src/core/memory.ts).
 */

'use strict';

const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const HEAP_FRACTION = 0.80;
const MIN_HEAP_MB = 512;
const MAX_HEAP_MB = 16_384; // 16 GB ceiling

// Node 22 exposes cgroup-aware memory; outside cgroups it returns 0.
const constrainedBytes = process.constrainedMemory();
const effectiveBytes = constrainedBytes > 0 ? constrainedBytes : os.totalmem();
const totalMemoryMB = Math.floor(effectiveBytes / (1024 * 1024));
const heapMB = Math.max(MIN_HEAP_MB, Math.min(MAX_HEAP_MB, Math.floor(totalMemoryMB * HEAP_FRACTION)));

const memorySource = constrainedBytes > 0 ? 'cgroup limit' : 'host total RAM';

const entrypoint = path.resolve(__dirname, '..', 'dist', 'index.js');

console.log(
    `[start] Memory source: ${memorySource} — ${totalMemoryMB} MB — setting --max-old-space-size=${heapMB} MB (${Math.round(HEAP_FRACTION * 100)}%)`
);

// Propagate the heap flag and --expose-gc through NODE_OPTIONS so that the child
// process (and any sub-processes it spawns) inherit the same settings.
const nodeOptions = process.env.NODE_OPTIONS || '';
const hasHeapFlag = /--max[-_]old[-_]space[-_]size/.test(nodeOptions);
const hasExposeGc = /--expose[-_]gc/.test(nodeOptions);

const extraFlags = [];
if (!hasHeapFlag) extraFlags.push(`--max-old-space-size=${heapMB}`);
if (!hasExposeGc) extraFlags.push('--expose-gc');

if (extraFlags.length > 0) {
    process.env.NODE_OPTIONS = `${nodeOptions} ${extraFlags.join(' ')}`.trim();
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
