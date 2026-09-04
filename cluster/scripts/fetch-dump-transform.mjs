#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tar from 'tar';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = path.join(packageRoot, 'vendor', 'volt-dump-transform');
const TOOL = 'volt-dump-transform';

const SYSTEM_TAGS = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
const MACHINE_TAGS = { x64: 'x86_64', arm64: 'arm64' };

const log = (line) => process.stdout.write(`[${TOOL}] ${line}\n`);

const platformTag = () => process.env.VOLT_DUMP_TRANSFORM_PLATFORM
    || `${SYSTEM_TAGS[os.platform()] ?? os.platform()}-${MACHINE_TAGS[os.arch()] ?? os.arch()}`;

const binaryName = () => (os.platform() === 'win32' ? `${TOOL}.exe` : TOOL);

const sha256 = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');

const download = async (url) => {
    const response = await fetch(url, { redirect: 'follow' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
};

const installFromOverride = async (binaryPath) => {
    await rm(vendorDir, { recursive: true, force: true });
    await mkdir(path.join(vendorDir, 'bin'), { recursive: true });
    const target = path.join(vendorDir, 'bin', binaryName());
    await copyFile(binaryPath, target);
    if (os.platform() !== 'win32') await chmod(target, 0o755);
    log(`installed from VOLT_DUMP_TRANSFORM_BIN=${binaryPath}`);
};

const main = async () => {
    if (process.env.VOLT_DUMP_TRANSFORM_SKIP_FETCH === '1') {
        log('fetch skipped (VOLT_DUMP_TRANSFORM_SKIP_FETCH=1)');
        return;
    }

    const override = process.env.VOLT_DUMP_TRANSFORM_BIN;
    if (override) {
        await installFromOverride(override);
        return;
    }

    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf-8'));
    const pin = manifest.voltDumpTransform;
    if (!pin?.repository || !pin?.release) {
        throw new Error('package.json needs voltDumpTransform.repository and voltDumpTransform.release');
    }

    const platform = platformTag();
    const assetName = `${TOOL}-${platform}.tar.gz`;
    const baseUrl = `https://github.com/${pin.repository}/releases/download/${pin.release}`;
    const stampPath = path.join(vendorDir, '.release');
    const currentStamp = await readFile(stampPath, 'utf-8').catch(() => null);
    if (currentStamp === `${pin.release} ${platform}` && await stat(path.join(vendorDir, 'bin', binaryName())).catch(() => null)) {
        log(`${pin.release} for ${platform} already present in vendor/`);
        return;
    }

    const cacheDir = path.join(os.homedir(), '.cache', 'volt-dump-transform', pin.release);
    await mkdir(cacheDir, { recursive: true });
    const cachedArchive = path.join(cacheDir, assetName);

    let archiveOk = await stat(cachedArchive).then(() => true, () => false);
    if (!archiveOk) {
        log(`downloading ${assetName} from ${pin.repository}@${pin.release}`);
        const archive = await download(`${baseUrl}/${assetName}`);
        if (!archive) {
            log(`no ${TOOL} build is published for ${platform}; slice/select/merge pipeline stages will not run on this host`);
            return;
        }
        const checksum = await download(`${baseUrl}/${assetName}.sha256`);
        if (!checksum) throw new Error(`${assetName}.sha256 is missing from the release`);
        const expected = checksum.toString('utf-8').trim().split(/\s+/)[0];
        const actual = createHash('sha256').update(archive).digest('hex');
        if (expected !== actual) throw new Error(`${assetName} sha256 mismatch: expected ${expected}, got ${actual}`);
        await writeFile(cachedArchive, archive);
        archiveOk = true;
    } else {
        log(`using cached ${cachedArchive} (${await sha256(cachedArchive)})`);
    }

    await rm(vendorDir, { recursive: true, force: true });
    await mkdir(vendorDir, { recursive: true });
    await tar.x({ file: cachedArchive, cwd: vendorDir });
    if (os.platform() !== 'win32') await chmod(path.join(vendorDir, 'bin', binaryName()), 0o755);
    await writeFile(stampPath, `${pin.release} ${platform}`);
    log(`installed ${pin.release} for ${platform} into vendor/${TOOL}/bin`);
};

main().catch((error) => {
    console.error(`[${TOOL}] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
