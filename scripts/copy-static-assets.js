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
        return;
    }

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
};

(async () => {
    await copyDirectory(
        path.join(root, 'src', 'modules', 'plugin', 'infrastructure', 'python'),
        path.join(root, 'dist', 'modules', 'plugin', 'infrastructure', 'python')
    );
    await copyFile(
        path.join(root, 'src', 'modules', 'trajectory', 'infrastructure', 'storage', 'parquet-ingest-worker.cjs'),
        path.join(root, 'dist', 'modules', 'trajectory', 'infrastructure', 'storage', 'parquet-ingest-worker.cjs')
    );
})().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
