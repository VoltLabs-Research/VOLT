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

(async () => {
    await copyDirectory(
        path.join(root, 'src', 'modules', 'plugin', 'infrastructure', 'python'),
        path.join(root, 'dist', 'modules', 'plugin', 'infrastructure', 'python')
    );
})().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
