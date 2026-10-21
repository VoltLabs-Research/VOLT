import os from 'node:os';
import path from 'node:path';
import AppConfig from '@/services/AppConfig';
import type { StackRuntimeLayout } from '@/services/StackRuntime';
import { DEFAULT_DAEMON_PORT, DEFAULT_SERVER_PORT } from '@volt/local-stack/defaults';
import { localDaemonEnv, localServerEnv, randomStackSecret, type StackPorts } from '@volt/local-stack/stack-env';
import type { BootstrapState } from '@volt/local-stack/state';

const MIN_DAEMON_HEAP_MB = 1024;
const MAX_DAEMON_HEAP_MB = 8192;
const DAEMON_HEAP_FRACTION = 0.25;

export const ensureStackEnvDefaults = async (appConfig: AppConfig): Promise<Record<string, string>> => {
    const env = await appConfig.getStackEnv();
    const next: Record<string, string> = {
        ...env,
        SERVER_PORT: env.SERVER_PORT ?? String(DEFAULT_SERVER_PORT),
        DAEMON_PORT: env.DAEMON_PORT ?? String(DEFAULT_DAEMON_PORT),
        SECRET_KEY: env.SECRET_KEY ?? randomStackSecret(),
        SSH_KEY: env.SSH_KEY ?? randomStackSecret()
    };

    if(Object.keys(next).some((key) => env[key] !== next[key])) await appConfig.setStackEnv(next);
    return next;
};

const baseEnv = (): Record<string, string> => {
    const env: Record<string, string> = {};
    for(const [key, value] of Object.entries(process.env)){
        if(value !== undefined && key !== 'NODE_OPTIONS' && key !== 'ELECTRON_RUN_AS_NODE' && key !== 'ELECTRON_NO_ASAR') env[key] = value;
    }
    return env;
};

// The backends exit with the desktop app that started them.
const parentEnv = (): Record<string, string> => ({
    VOLT_EXIT_WITH_PARENT: '1',
    VOLT_PARENT_PID: String(process.pid)
});

const serverDataDir = (stackDataDir: string): string => path.join(stackDataDir, 'server');

const daemonDataDir = (stackDataDir: string): string => path.join(stackDataDir, 'daemon');

export const buildServerEnv = (input: {
    runtime: StackRuntimeLayout;
    stackEnv: Record<string, string>;
    stackDataDir: string;
    ports: StackPorts;
}): Record<string, string> => {
    const dataDir = serverDataDir(input.stackDataDir);

    return {
        ...baseEnv(),
        ...parentEnv(),
        ...localServerEnv({
            ports: input.ports,
            dataDir,
            databasePath: path.join(dataDir, 'server.sqlite'),
            secrets: {
                secretKey: input.stackEnv.SECRET_KEY,
                sshKey: input.stackEnv.SSH_KEY
            },
            logLevel: input.stackEnv.LOG_LEVEL
        }),
        CLIENT_DIST_DIR: input.runtime.clientDir,
        STATIC_ROOT: path.join(input.runtime.serverDir, 'static')
    };
};

const daemonHeapMb = (): number => {
    const totalMb = Math.floor(os.totalmem() / (1024 * 1024));
    return Math.min(MAX_DAEMON_HEAP_MB, Math.max(MIN_DAEMON_HEAP_MB, Math.floor(totalMb * DAEMON_HEAP_FRACTION)));
};

export const buildDaemonEnv = (input: {
    runtime?: StackRuntimeLayout;
    stackEnv: Record<string, string>;
    stackDataDir: string;
    ports: StackPorts;
    bootstrap: BootstrapState;
}): Record<string, string> => {
    const zstdBin = input.runtime
        ? path.join(input.runtime.daemonDir, 'vendor', 'zstd', 'bin', process.platform === 'win32' ? 'zstd.exe' : 'zstd')
        : undefined;
    const dumpTransformBin = input.runtime
        ? path.join(input.runtime.daemonDir, 'vendor', 'volt-dump-transform', 'bin', process.platform === 'win32' ? 'volt-dump-transform.exe' : 'volt-dump-transform')
        : undefined;
    const vendorLib = input.runtime
        ? path.join(input.runtime.daemonDir, 'vendor', 'zstd', 'lib')
        : '';
    const vendorBin = input.runtime
        ? [
            path.join(input.runtime.daemonDir, 'vendor', 'zstd', 'bin'),
            path.join(input.runtime.daemonDir, 'vendor', 'volt-dump-transform', 'bin')
        ].join(path.delimiter)
        : '';

    return {
        ...baseEnv(),
        ...(vendorBin ? { PATH: `${vendorBin}${path.delimiter}${process.env.PATH ?? ''}` } : {}),
        ...(vendorLib ? {
            LD_LIBRARY_PATH: `${vendorLib}${path.delimiter}${process.env.LD_LIBRARY_PATH ?? ''}`,
            DYLD_LIBRARY_PATH: `${vendorLib}${path.delimiter}${process.env.DYLD_LIBRARY_PATH ?? ''}`
        } : {}),
        ...(zstdBin ? { VOLT_ZSTD_BIN: zstdBin } : {}),
        ...(dumpTransformBin ? { VOLT_DUMP_TRANSFORM_BIN: dumpTransformBin } : {}),
        ...parentEnv(),
        ...localDaemonEnv({
            ports: input.ports,
            dataDir: daemonDataDir(input.stackDataDir),
            bootstrap: input.bootstrap,
            logLevel: input.stackEnv.LOG_LEVEL
        }),
        DAEMON_HEAP_MB: String(daemonHeapMb())
    };
};
