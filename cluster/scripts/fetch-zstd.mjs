#!/usr/bin/env node
import { chmod, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import unzipper from 'unzipper';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = path.join(packageRoot, 'vendor', 'zstd');
const TOOL = 'zstd';
const WIN_RELEASE = 'v1.5.7';
const WIN_ASSET = 'zstd-v1.5.7-win64.zip';

const log = (line) => process.stdout.write(`[${TOOL}] ${line}\n`);

const binaryName = () => (os.platform() === 'win32' ? `${TOOL}.exe` : TOOL);

const download = async (url) => {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
};

const which = (name) => {
    const result = spawnSync(os.platform() === 'win32' ? 'where' : 'which', [name], {
        encoding: 'utf8'
    });
    if (result.status !== 0) return null;
    return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
};

const exists = (file) => stat(file).then(() => true, () => false);

const findFile = async (dir, name) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const nested = await findFile(next, name);
            if (nested) return nested;
        } else if (entry.name === name) {
            return next;
        }
    }
    return null;
};

const installBinary = async (source) => {
    await rm(vendorDir, { recursive: true, force: true });
    await mkdir(path.join(vendorDir, 'bin'), { recursive: true });
    const target = path.join(vendorDir, 'bin', binaryName());
    await copyFile(source, target);
    if (os.platform() !== 'win32') await chmod(target, 0o755);
    return target;
};

const installFromSystem = async () => {
    const candidates = [
        which('zstd'),
        '/usr/bin/zstd',
        '/usr/local/bin/zstd',
        '/opt/homebrew/bin/zstd'
    ].filter((candidate) => typeof candidate === 'string' && candidate.length > 0);

    for (const candidate of candidates) {
        if (!await exists(candidate)) continue;
        const target = await installBinary(candidate);
        await writeFile(path.join(vendorDir, '.release'), `system ${os.platform()}-${os.arch()}`);
        log(`copied ${candidate} -> ${target}`);
        return;
    }

    throw new Error('zstd is not installed. Install it (apt/brew) or set VOLT_ZSTD_BIN');
};

const installWindowsRelease = async () => {
    const stamp = `${WIN_RELEASE} windows-x86_64`;
    const stampPath = path.join(vendorDir, '.release');
    const currentStamp = await readFile(stampPath, 'utf-8').catch(() => null);
    const existing = path.join(vendorDir, 'bin', binaryName());
    if (currentStamp === stamp && await exists(existing)) {
        log(`${stamp} already present in vendor/`);
        return;
    }

    const cacheDir = path.join(os.homedir(), '.cache', 'volt-zstd', WIN_RELEASE);
    await mkdir(cacheDir, { recursive: true });
    const cached = path.join(cacheDir, WIN_ASSET);
    if (!await exists(cached)) {
        const url = `https://github.com/facebook/zstd/releases/download/${WIN_RELEASE}/${WIN_ASSET}`;
        log(`downloading ${WIN_ASSET}`);
        await writeFile(cached, await download(url));
    }

    const extractDir = path.join(cacheDir, 'extract');
    await rm(extractDir, { recursive: true, force: true });
    await mkdir(extractDir, { recursive: true });
    const directory = await unzipper.Open.file(cached);
    await directory.extract({ path: extractDir });

    const exe = await findFile(extractDir, 'zstd.exe');
    if (!exe) throw new Error(`${WIN_ASSET} did not contain zstd.exe`);

    await installBinary(exe);
    await writeFile(stampPath, stamp);
    log(`installed ${stamp} into vendor/zstd/bin`);
};

const main = async () => {
    if (process.env.VOLT_ZSTD_SKIP_FETCH === '1') {
        log('fetch skipped (VOLT_ZSTD_SKIP_FETCH=1)');
        return;
    }

    const override = process.env.VOLT_ZSTD_BIN;
    if (override) {
        await installBinary(override);
        await writeFile(path.join(vendorDir, '.release'), `override ${override}`);
        log(`installed from VOLT_ZSTD_BIN=${override}`);
        return;
    }

    if (os.platform() === 'win32') {
        await installWindowsRelease();
        return;
    }

    await installFromSystem();
};

main().catch((error) => {
    console.error(`[${TOOL}] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
