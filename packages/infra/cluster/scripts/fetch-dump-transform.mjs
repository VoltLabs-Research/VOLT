#!/usr/bin/env node
import { chmod, copyFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostPlatformTag, installCoreToolkitTool } from './coretoolkit-tool.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = path.join(packageRoot, 'vendor', 'volt-dump-transform');
const TOOL = 'volt-dump-transform';

const log = (line) => process.stdout.write(`[${TOOL}] ${line}\n`);

const binaryName = () => (os.platform() === 'win32' ? `${TOOL}.exe` : TOOL);

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

    const platform = process.env.VOLT_DUMP_TRANSFORM_PLATFORM || hostPlatformTag();
    if (!await installCoreToolkitTool({ tool: TOOL, platform, vendorDir, log })) {
        log(`no ${TOOL} build is published for ${platform}; slice/select/merge will be unavailable on this host`);
    }
};

main().catch((error) => {
    console.error(`[${TOOL}] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
