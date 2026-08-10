#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const HEAP_FRACTION = 0.80;
const MIN_HEAP_MB = 512;
const MAX_HEAP_MB = 16_384;

const constrainedBytes = process.constrainedMemory();
const effectiveBytes = constrainedBytes > 0 ? constrainedBytes : os.totalmem();
const totalMemoryMB = Math.floor(effectiveBytes / (1024 * 1024));
const heapMB = Math.max(MIN_HEAP_MB, Math.min(MAX_HEAP_MB, Math.floor(totalMemoryMB * HEAP_FRACTION)));

const memorySource = constrainedBytes > 0 ? 'cgroup limit' : 'host total RAM';

const entrypoint = path.resolve(__dirname, '..', 'dist', 'daemon.js');

console.log(
    `[start] Memory source: ${memorySource} — ${totalMemoryMB} MB — setting --max-old-space-size=${heapMB} MB (${Math.round(HEAP_FRACTION * 100)}%)`
);

const nodeOptions = process.env.NODE_OPTIONS || '';
const hasHeapFlag = /--max[-_]old[-_]space[-_]size/.test(nodeOptions);

if (!hasHeapFlag) {
    process.env.NODE_OPTIONS = `${nodeOptions} --max-old-space-size=${heapMB}`.trim();
}

try {
    execFileSync(process.execPath, [entrypoint], {
        stdio: 'inherit',
        env: process.env
    });
} catch (err) {
    process.exit(err.status || 1);
}
