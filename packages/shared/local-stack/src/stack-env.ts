import { serverOriginFor } from './defaults';
import type { BootstrapState } from './state';

export interface StackPorts{
    server: number;
    daemon: number;
}

export interface StackSecrets{
    secretKey: string;
    sshKey: string;
}

export const randomStackSecret = (): string => (
    Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
);

// The environment the server starts with in a local stack, whichever host runs it.
export const localServerEnv = (input: {
    ports: StackPorts;
    dataDir: string;
    databasePath: string;
    secrets: StackSecrets;
    logLevel?: string;
    // Where the web client is served from: the server itself on the desktop, the page in a browser.
    clientOrigin?: string;
}): Record<string, string> => {
    const origin = serverOriginFor(input.ports.server);
    return {
        NODE_ENV: 'production',
        LOG_LEVEL: input.logLevel ?? 'info',
        DEPLOYMENT_MODE: 'local',
        SERVER_HOST: '127.0.0.1',
        SERVER_PORT: String(input.ports.server),
        SERVER_ENDPOINT: origin,
        CLIENT_HOST: input.clientOrigin ?? origin,
        DATABASE_URL: `sqlite:${input.databasePath}`,
        SERVER_DATA_DIR: input.dataDir,
        SECRET_KEY: input.secrets.secretKey,
        SSH_ENCRYPTION_KEY: input.secrets.sshKey
    };
};

// The environment the daemon starts with, enrolled as the cluster the bootstrap provisioned.
export const localDaemonEnv = (input: {
    ports: StackPorts;
    dataDir: string;
    bootstrap: BootstrapState;
    logLevel?: string;
}): Record<string, string> => ({
    NODE_ENV: 'production',
    LOG_LEVEL: input.logLevel ?? 'info',
    HOST: '127.0.0.1',
    PORT: String(input.ports.daemon),
    TEAM_ID: input.bootstrap.teamId,
    TEAM_CLUSTER_ID: input.bootstrap.teamClusterId,
    TEAM_CLUSTER_DAEMON_PASSWORD: input.bootstrap.daemonPassword,
    VOLT_CLOUD_URL: serverOriginFor(input.ports.server),
    DAEMON_DATA_DIR: input.dataDir,
    BUCKET_PREFIX: 'cluster-',
    OBJECT_GATEWAY_PUBLIC_BASE_URL: `http://127.0.0.1:${input.ports.daemon}`
});
