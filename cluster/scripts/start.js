#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const HEAP_FRACTION = 0.80;
const MIN_HEAP_MB = 512;

/**
 * Sanity bound only. The ceiling below is derived from the machine's own memory, so
 * this exists to reject a nonsensical reading — not to cap real hosts. It used to be
 * 16 GB, which silently held a 31 GB machine to half its RAM.
 */
const MAX_HEAP_MB = 262_144;

const totalBytes = os.totalmem();
const constrainedBytes = process.constrainedMemory();

/**
 * `constrainedMemory()` is documented to return 0 when the limit is unknown, but a
 * cgroup v2 container with `memory.max = max` reports UINT64_MAX instead. Taken at
 * face value that makes every unlimited container look like it has 16 EB of RAM, so
 * the derived ceiling collapses onto whatever MAX_HEAP_MB happens to be rather than
 * tracking the host. Anything at or above the host's own total is not a real limit.
 */
const isConstrained = constrainedBytes > 0 && constrainedBytes < totalBytes;
const effectiveBytes = isConstrained ? constrainedBytes : totalBytes;
const totalMemoryMB = Math.floor(effectiveBytes / (1024 * 1024));
const derivedHeapMB = Math.max(
    MIN_HEAP_MB,
    Math.min(MAX_HEAP_MB, Math.floor(totalMemoryMB * HEAP_FRACTION))
);

/**
 * Escape hatch for hosts where the fraction is wrong in either direction — a machine
 * shared with other services wants less, a dedicated analysis box can take more.
 */
const overrideRaw = process.env.DAEMON_HEAP_MB;
const overrideHeapMB = Number.parseInt(overrideRaw ?? '', 10);
const hasOverride = Number.isInteger(overrideHeapMB) && overrideHeapMB >= MIN_HEAP_MB;

if (overrideRaw !== undefined && overrideRaw !== '' && !hasOverride) {
    console.warn(
        `[start] Ignoring DAEMON_HEAP_MB="${overrideRaw}" — expected an integer of at least ${MIN_HEAP_MB} MB`
    );
}

const heapMB = hasOverride ? overrideHeapMB : derivedHeapMB;
const memorySource = isConstrained ? 'cgroup limit' : 'host total RAM';
const sizing = hasOverride
    ? 'DAEMON_HEAP_MB override'
    : `${Math.round(HEAP_FRACTION * 100)}% of ${totalMemoryMB} MB ${memorySource}`;

console.log(`[start] Setting --max-old-space-size=${heapMB} MB (${sizing})`);

const nodeOptions = process.env.NODE_OPTIONS || '';
const hasHeapFlag = /--max[-_]old[-_]space[-_]size/.test(nodeOptions);

if (hasHeapFlag) {
    console.log(`[start] NODE_OPTIONS already carries a heap flag — leaving it alone: ${nodeOptions}`);
} else {
    process.env.NODE_OPTIONS = `${nodeOptions} --max-old-space-size=${heapMB}`.trim();
}

const packageRoot = path.resolve(__dirname, '..');

/**
 * The container stack runs the daemon from source through tsx (`npm run dev`), while
 * enrolled hosts run the compiled output. Both need the ceiling above, so both come
 * through here; tsx forwards NODE_OPTIONS to the node process it starts.
 */
const isDevMode = process.argv.includes('--dev');
const command = isDevMode ? path.join(packageRoot, 'node_modules', '.bin', 'tsx') : process.execPath;
const commandArgs = isDevMode ? ['src/daemon.ts'] : [path.join(packageRoot, 'dist', 'daemon.js')];

const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    cwd: packageRoot,
    env: process.env
});

/*
 * `daemon.ts` releases queue leases, drains the plugin pool and closes the planes from
 * its own SIGTERM handler, and that only happens if the signal reaches it. This wrapper
 * sits between the container's PID 1 and the daemon, so it has to pass signals down: a
 * synchronous exec takes the signal itself and leaves the daemon orphaned until the
 * runtime's SIGKILL, which strands every lease it was holding.
 */
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(signal, () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill(signal);
        }
    });
}

child.on('error', (err) => {
    console.error(`[start] Could not launch ${command}: ${err.message}`);
    process.exit(1);
});

child.on('exit', (code, signal) => {
    process.exit(signal ? 128 + (os.constants.signals[signal] ?? 0) : code ?? 0);
});
