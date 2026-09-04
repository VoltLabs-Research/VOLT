#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile, chmod, access, lstat, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const voltDir = path.resolve(desktopDir, '..');
const outDir = path.join(desktopDir, 'stack-runtime');

const args = new Set(process.argv.slice(2));
const skipClient = args.has('--skip-client');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const log = (line) => process.stdout.write(`[stack] ${line}\n`);

const run = (command, commandArgs, cwd, env = {}) => new Promise((resolve, reject) => {
    log(`${path.relative(voltDir, cwd) || '.'}$ ${command} ${commandArgs.join(' ')}`);
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

const ensureInstalled = async (dir) => {
    if (await exists(path.join(dir, 'node_modules'))) return;
    await run(npmCommand, ['ci', '--no-audit', '--no-fund'], dir);
};

const copyTree = async (from, to) => {
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { recursive: true, dereference: true, force: true });
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf-8'));

const buildSdk = async () => {
    const sdkDir = path.join(voltDir, 'sdk', 'node', 'DaemonClusterClient');
    await ensureInstalled(sdkDir);
    await run(npmCommand, ['run', 'build'], sdkDir);

    const target = path.join(outDir, 'sdk', 'node', 'DaemonClusterClient');
    await copyTree(path.join(sdkDir, 'dist'), path.join(target, 'dist'));
    await cp(path.join(sdkDir, 'package.json'), path.join(target, 'package.json'));
};

const buildClient = async () => {
    const clientDir = path.join(voltDir, 'client');
    if (!skipClient) {
        await ensureInstalled(clientDir);
        await run(npmCommand, ['run', 'build'], clientDir);
    }
    await copyTree(path.join(clientDir, 'dist'), path.join(outDir, 'client'));
};

const materializeLinkedSdk = async (target) => {
    const linkPath = path.join(target, 'node_modules', '@voltstack', 'daemon-cluster-client');
    const stat = await lstat(linkPath).catch(() => null);
    if (!stat?.isSymbolicLink()) return;
    const source = await realpath(linkPath);
    await rm(linkPath, { recursive: true, force: true });
    await cp(source, linkPath, { recursive: true, dereference: true });
};

const installProductionDependencies = async (target) => {
    await run(npmCommand, ['ci', '--omit=dev', '--no-audit', '--no-fund'], target, { NODE_ENV: 'production' });
    await materializeLinkedSdk(target);
};

const buildServer = async () => {
    const serverDir = path.join(voltDir, 'server');
    await ensureInstalled(serverDir);
    await run(npmCommand, ['run', 'build'], serverDir);

    const target = path.join(outDir, 'server');
    await copyTree(path.join(serverDir, 'dist'), path.join(target, 'dist'));
    await copyTree(path.join(serverDir, 'static'), path.join(target, 'static'));
    for (const file of ['package.json', 'package-lock.json']) {
        await cp(path.join(serverDir, file), path.join(target, file));
    }
    await installProductionDependencies(target);
};

const buildDaemon = async () => {
    const daemonDir = path.join(voltDir, 'cluster');
    await ensureInstalled(daemonDir);
    await run(npmCommand, ['run', 'build'], daemonDir);

    const target = path.join(outDir, 'daemon');
    await copyTree(path.join(daemonDir, 'dist'), path.join(target, 'dist'));
    await mkdir(path.join(target, 'scripts'), { recursive: true });
    await cp(path.join(daemonDir, 'scripts', 'start.js'), path.join(target, 'scripts', 'start.js'));
    for (const file of ['package.json', 'package-lock.json']) {
        await cp(path.join(daemonDir, file), path.join(target, file));
    }
    await installProductionDependencies(target);
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
        readJson(path.join(voltDir, 'server', 'package.json')),
        readJson(path.join(voltDir, 'cluster', 'package.json')),
        readJson(path.join(voltDir, 'client', 'package.json'))
    ]);
    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({
        builtAt: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        nodeBinary: path.relative(outDir, nodeBinary),
        server: { version: server.version, entry: 'server/dist/server/src/server.js' },
        daemon: { version: daemon.version, entry: 'daemon/scripts/start.js' },
        client: { version: client.version, dir: 'client' }
    }, null, 2) + '\n');
};

const main = async () => {
    const startedAt = Date.now();
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    await buildSdk();
    await buildClient();
    await buildServer();
    await buildDaemon();
    await rm(path.join(outDir, 'sdk'), { recursive: true, force: true });
    const nodeBinary = await bundleNode();
    await writeManifest(nodeBinary);

    log(`runtime assembled at ${outDir} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
