// A command-line tool of the CoreToolkit release package.json pins (coreToolkitTools), installed as
// <vendorDir>/bin/<tool> with what its bundle carries beside it: shared libraries, or the .wasm of a
// WebAssembly build. The daemon's own fetch scripts install the host's build; @volt/web-runtime
// installs the wasm-wasm32 builds of a daemon running in a browser.
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tar from 'tar';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SYSTEM_TAGS = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
const MACHINE_TAGS = { x64: 'x86_64', arm64: 'arm64' };

export const hostPlatformTag = () =>
    `${SYSTEM_TAGS[os.platform()] ?? os.platform()}-${MACHINE_TAGS[os.arch()] ?? os.arch()}`;

const binaryName = (tool, platform) => (platform.startsWith('windows-') ? `${tool}.exe` : tool);

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const download = async (url) => {
    const response = await fetch(url, { redirect: 'follow' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
};

const readPin = async () => {
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf-8'));
    const pin = manifest.coreToolkitTools;
    if (!pin?.repository || !pin?.release) {
        throw new Error('package.json needs coreToolkitTools.repository and coreToolkitTools.release');
    }
    return pin;
};

// Resolves false when the release has no build of the tool for the platform.
export const installCoreToolkitTool = async ({ tool, platform, vendorDir, log }) => {
    const pin = await readPin();
    const binary = path.join(vendorDir, 'bin', binaryName(tool, platform));
    const stamp = `${pin.release} ${platform}`;
    const stampPath = path.join(vendorDir, '.release');
    if (await readFile(stampPath, 'utf-8').catch(() => null) === stamp && await stat(binary).catch(() => null)) {
        log(`${pin.release} for ${platform} already present in ${vendorDir}`);
        return true;
    }

    const assetName = `${tool}-${platform}.tar.gz`;
    const baseUrl = `https://github.com/${pin.repository}/releases/download/${pin.release}`;
    const cacheDir = path.join(os.homedir(), '.cache', tool, pin.release);
    const cachedArchive = path.join(cacheDir, assetName);
    if (await stat(cachedArchive).then(() => true, () => false)) {
        log(`using cached ${cachedArchive} (${sha256(await readFile(cachedArchive))})`);
    } else {
        log(`downloading ${assetName} from ${pin.repository}@${pin.release}`);
        const archive = await download(`${baseUrl}/${assetName}`);
        if (!archive) return false;
        const checksum = await download(`${baseUrl}/${assetName}.sha256`);
        if (!checksum) throw new Error(`${assetName}.sha256 is missing from the release`);
        const expected = checksum.toString('utf-8').trim().split(/\s+/)[0];
        const actual = sha256(archive);
        if (expected !== actual) throw new Error(`${assetName} sha256 mismatch: expected ${expected}, got ${actual}`);
        await mkdir(cacheDir, { recursive: true });
        await writeFile(cachedArchive, archive);
    }

    await rm(vendorDir, { recursive: true, force: true });
    await mkdir(vendorDir, { recursive: true });
    await tar.x({ file: cachedArchive, cwd: vendorDir });
    if (!platform.startsWith('windows-')) await chmod(binary, 0o755);
    await writeFile(stampPath, stamp);
    log(`installed ${pin.release} for ${platform} into ${vendorDir}`);
    return true;
};
