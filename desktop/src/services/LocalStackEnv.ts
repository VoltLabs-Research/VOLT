import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import AppConfig, { BootstrapState } from '@/services/AppConfig';
import type { StackRuntimeLayout } from '@/services/StackRuntime';

export interface StackPorts{
    server: number;
    daemon: number;
}

const DEFAULT_SERVER_PORT = 8100;
const DEFAULT_DAEMON_PORT = 18080;

const MIN_DAEMON_HEAP_MB = 1024;
const MAX_DAEMON_HEAP_MB = 8192;
const DAEMON_HEAP_FRACTION = 0.25;

const randomSecret = (): string => randomBytes(32).toString('hex');

export const serverOriginFor = (port: number): string => `http://127.0.0.1:${port}`;

export const ensureStackEnvDefaults = async (appConfig: AppConfig): Promise<Record<string, string>> => {
    const env = await appConfig.getStackEnv();
    const next: Record<string, string> = {
        ...env,
        SERVER_PORT: env.SERVER_PORT ?? String(DEFAULT_SERVER_PORT),
        DAEMON_PORT: env.DAEMON_PORT ?? String(DEFAULT_DAEMON_PORT),
        SECRET_KEY: env.SECRET_KEY ?? randomSecret(),
        SSH_KEY: env.SSH_KEY ?? randomSecret()
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

const serverDataDir = (stackDataDir: string): string => path.join(stackDataDir, 'server');

const daemonDataDir = (stackDataDir: string): string => path.join(stackDataDir, 'daemon');

export const buildServerEnv = (input: {
    runtime: StackRuntimeLayout;
    stackEnv: Record<string, string>;
    stackDataDir: string;
    ports: StackPorts;
}): Record<string, string> => {
    const origin = serverOriginFor(input.ports.server);
    const dataDir = serverDataDir(input.stackDataDir);

    return {
        ...baseEnv(),
        VOLT_EXIT_WITH_PARENT: '1',
        VOLT_PARENT_PID: String(process.pid),
        NODE_ENV: 'production',
        LOG_LEVEL: input.stackEnv.LOG_LEVEL ?? 'info',
        DEPLOYMENT_MODE: 'local',
        SERVER_HOST: '127.0.0.1',
        SERVER_PORT: String(input.ports.server),
        SERVER_ENDPOINT: origin,
        CLIENT_HOST: origin,
        CLIENT_DIST_DIR: input.runtime.clientDir,
        DATABASE_URL: `sqlite:${path.join(dataDir, 'server.sqlite')}`,
        SERVER_DATA_DIR: dataDir,
        STATIC_ROOT: path.join(input.runtime.serverDir, 'static'),
        SECRET_KEY: input.stackEnv.SECRET_KEY,
        SSH_ENCRYPTION_KEY: input.stackEnv.SSH_KEY
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
    const gatewayOrigin = `http://127.0.0.1:${input.ports.daemon}`;
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
        VOLT_EXIT_WITH_PARENT: '1',
        VOLT_PARENT_PID: String(process.pid),
        NODE_ENV: 'production',
        LOG_LEVEL: input.stackEnv.LOG_LEVEL ?? 'info',
        HOST: '127.0.0.1',
        PORT: String(input.ports.daemon),
        TEAM_ID: input.bootstrap.teamId,
        TEAM_CLUSTER_ID: input.bootstrap.teamClusterId,
        TEAM_CLUSTER_DAEMON_PASSWORD: input.bootstrap.daemonPassword,
        VOLT_CLOUD_URL: serverOriginFor(input.ports.server),
        DAEMON_DATA_DIR: daemonDataDir(input.stackDataDir),
        BUCKET_PREFIX: 'cluster-',
        OBJECT_GATEWAY_PUBLIC_BASE_URL: gatewayOrigin,
        DAEMON_HEAP_MB: String(daemonHeapMb())
    };
};
