#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile, chmod, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceDir = path.resolve(desktopDir, '..', '..', '..');
const outDir = path.join(desktopDir, 'stack-runtime');

const args = new Set(process.argv.slice(2));
const skipClient = args.has('--skip-client');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const log = (line) => process.stdout.write(`[stack] ${line}\n`);

const run = (command, commandArgs, cwd, env = {}) => new Promise((resolve, reject) => {
    log(`${path.relative(workspaceDir, cwd) || '.'}$ ${command} ${commandArgs.join(' ')}`);
    const child = spawn(command, commandArgs, {
        cwd,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: { ...process.env, ...env }
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${commandArgs.join(' ')} exited with ${code} in ${cwd}`))));
});

const exists = (target) => access(target).then(() => true, () => false);

const copyTree = async (from, to) => {
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { recursive: true, dereference: true, force: true });
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf-8'));

const packageDir = (...segments) => path.join(workspaceDir, 'packages', ...segments);

const ensureInstalled = async () => {
    if (await exists(path.join(workspaceDir, 'node_modules'))) return;
    await run(pnpmCommand, ['install', '--frozen-lockfile'], workspaceDir);
};

// `<name>...` also selects the workspace packages each one depends on (the SDKs), and
// pnpm builds those first.
const buildPackages = async () => {
    const names = ['volt-server', 'cluster-daemon', ...(skipClient ? [] : ['volt-webapp'])];
    await run(pnpmCommand, [...names.flatMap((name) => ['--filter', `${name}...`]), 'build'], workspaceDir);
};

// `pnpm deploy` copies a package's `files` and production dependencies into a standalone
// directory, with the SDK copied in instead of linked to the workspace. The hoisted linker
// keeps that node_modules flat and free of symlinks, so it survives being packaged.
const deploy = async (name, target) => {
    await run(pnpmCommand, ['--filter', name, '--prod', 'deploy', '--legacy', '--config.node-linker=hoisted', target], workspaceDir);
    await run(process.execPath, ['-e', "require('@voltstack/daemon-cluster-client')"], target);
};

const assembleDaemon = async () => {
    const target = path.join(outDir, 'daemon');
    await deploy('cluster-daemon', target);

    // Copied on its own, dereferenced, because deploy drops the shared-library symlinks in it.
    const vendorDir = packageDir('infra', 'cluster', 'vendor');
    if (!await exists(vendorDir)) {
        throw new Error('daemon runtime is missing vendor/ (run pnpm run fetch:tools in packages/infra/cluster/)');
    }
    await copyTree(vendorDir, path.join(target, 'vendor'));
    const zstdBin = path.join(target, 'vendor', 'zstd', 'bin', process.platform === 'win32' ? 'zstd.exe' : 'zstd');
    const dumpTransformBin = path.join(target, 'vendor', 'volt-dump-transform', 'bin', process.platform === 'win32' ? 'volt-dump-transform.exe' : 'volt-dump-transform');
    if (!await exists(zstdBin)) {
        throw new Error(`daemon runtime is missing ${path.relative(target, zstdBin)}`);
    }
    if (!await exists(dumpTransformBin)) {
        throw new Error(`daemon runtime is missing ${path.relative(target, dumpTransformBin)}`);
    }
    const zstdLib = path.join(target, 'vendor', 'zstd', 'lib');
    await run(zstdBin, ['--version'], target, {
        LD_LIBRARY_PATH: zstdLib,
        DYLD_LIBRARY_PATH: zstdLib
    });
    for (const script of ['daemon', 'control-plane', 'heartbeat-plane', 'socket-channel-plane']) {
        const entry = path.join(target, 'dist', `${script}.js`);
        if (!await exists(entry)) {
            throw new Error(`daemon runtime is missing ${path.relative(target, entry)}`);
        }
        await run(process.execPath, ['--check', entry], target);
    }
};

const bundleNode = async () => {
    const binDir = path.join(outDir, 'bin');
    await mkdir(binDir, { recursive: true });
    const target = path.join(binDir, process.platform === 'win32' ? 'node.exe' : 'node');
    await cp(process.execPath, target, { force: true });
    if (process.platform !== 'win32') await chmod(target, 0o755);
    return target;
};

const writeManifest = async (nodeBinary) => {
    const [server, daemon, client] = await Promise.all([
        readJson(packageDir('infra', 'server', 'package.json')),
        readJson(packageDir('infra', 'cluster', 'package.json')),
        readJson(packageDir('apps', 'client', 'package.json'))
    ]);
    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({
        builtAt: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        nodeBinary: path.relative(outDir, nodeBinary),
        server: { version: server.version, entry: 'server/dist/infra/server/src/server.js' },
        daemon: { version: daemon.version, entry: 'daemon/scripts/start.js' },
        client: { version: client.version, dir: 'client' }
    }, null, 2) + '\n');
};

const main = async () => {
    const startedAt = Date.now();
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    await ensureInstalled();
    await buildPackages();
    await copyTree(packageDir('apps', 'client', 'dist'), path.join(outDir, 'client'));
    await deploy('volt-server', path.join(outDir, 'server'));
    await assembleDaemon();
    const nodeBinary = await bundleNode();
    await writeManifest(nodeBinary);

    log(`runtime assembled at ${outDir} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
