#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const copyDirectory = async (from, to) => {
    try {
        const stat = await fs.stat(from);
        if (!stat.isDirectory()) return;
    } catch {
        return;
    }

    await fs.mkdir(to, { recursive: true });
    await fs.cp(from, to, {
        recursive: true,
        force: true
    });
};

const copyFile = async (from, to) => {
    try {
        const stat = await fs.stat(from);
        if (!stat.isFile()) return;
    } catch {
        throw new Error(`missing build asset: ${path.relative(root, from)}`);
    }

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
};

const ASSETS = [
    'modules/plugin/services/python/volt_plugin_stub.py',
    'modules/trajectory/services/parsing/ase_export_bridge.py',
    'modules/trajectory/workers/parquet-ingest-worker.cjs',
    'modules/trajectory/workers/element-table.cjs'
];

(async () => {
    for (const asset of ASSETS) {
        await copyFile(path.join(root, 'src', asset), path.join(root, 'dist', asset));
    }

    await copyDirectory(
        path.join(root, 'src', 'modules', 'plugin', 'services', 'python'),
        path.join(root, 'dist', 'modules', 'plugin', 'services', 'python')
    );
})().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
