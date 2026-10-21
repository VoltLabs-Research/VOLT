// A local stack in the browser: the server and daemon as workers of this page, provisioned exactly as
// the desktop provisions its own (@volt/local-stack). Their files live in the origin's private file
// system, so the workspace persists between visits as the desktop's data directory does.
import { BackendHost } from './BackendHost';
import { BrowserStackStore } from './browser-stack-store';
import { DEFAULT_DAEMON_PORT, DEFAULT_SERVER_PORT, serverOriginFor } from '@volt/local-stack/defaults';
import { provisionLocalStack, type PhaseRunner } from '@volt/local-stack/provision';
import { localDaemonEnv, localServerEnv } from '@volt/local-stack/stack-env';
import type { BootstrapState, ProvisioningLog } from '@volt/local-stack/state';

export interface BrowserStackOptions {
    // Where the runtime's built workers are served (scripts/build.mjs's dist).
    runtimeUrl: URL;
    // The origin the web client is served from.
    clientOrigin: string;
    // The plugin registry, when not the public one.
    registryUrl?: string;
    store?: BrowserStackStore;
    log?: ProvisioningLog;
    phase?: PhaseRunner;
    // Distinguishes the private file system directories of separate stacks (the smoke tests').
    storagePrefix?: string;
}

export interface BrowserStack {
    host: BackendHost;
    state: BootstrapState;
    serverOrigin: string;
}

const PORTS = { server: DEFAULT_SERVER_PORT, daemon: DEFAULT_DAEMON_PORT };

export const startBrowserStack = async (options: BrowserStackOptions): Promise<BrowserStack> => {
    const store = options.store ?? new BrowserStackStore();
    const prefix = options.storagePrefix ?? 'volt';
    const serverOrigin = serverOriginFor(PORTS.server);
    const host = new BackendHost();
    // Provisioning reaches the server at its loopback origin, as it does on the desktop.
    Object.assign(globalThis, { fetch: host.fetch });

    let daemonFailure: string | null = null;
    host.onExit = (name, code) => {
        if(name === 'daemon'){
            daemonFailure = `The compute daemon exited with code ${code}`;
        }
    };

    const secrets = await store.getSecrets();
    const state = await provisionLocalStack({
        backends: {
            startServer: () => host.start({
                name: 'server',
                scriptUrl: new URL('server.worker.js', options.runtimeUrl),
                port: PORTS.server,
                boot: {
                    env: localServerEnv({
                        ports: PORTS,
                        dataDir: '/data/server',
                        databasePath: '/data/server/server.sqlite',
                        secrets,
                        clientOrigin: options.clientOrigin,
                        registryUrl: options.registryUrl
                    }),
                    argv: [],
                    cwd: '/app/server',
                    fs: { directory: `${prefix}-server` },
                    sqliteDirectory: `.${prefix}-server-sqlite`
                }
            }),
            // The daemon is up once it connects, which provisioning waits for; a start that fails
            // is reported through daemonFailure.
            startDaemon: async (bootstrap) => {
                host.start({
                    name: 'daemon',
                    scriptUrl: new URL('daemon.worker.js', options.runtimeUrl),
                    port: PORTS.daemon,
                    boot: {
                        env: localDaemonEnv({ ports: PORTS, dataDir: '/data/daemon', bootstrap }),
                        argv: [],
                        cwd: '/app/daemon',
                        fs: { directory: `${prefix}-daemon` },
                        sqliteDirectory: `.${prefix}-daemon-sqlite`
                    }
                }).catch((error: Error) => {
                    daemonFailure = error.message;
                });
            },
            daemonFailure: () => daemonFailure,
            logHint: 'See the browser console for the daemon\'s output.'
        },
        serverOrigin,
        store,
        log: options.log ?? ((stream, line) => (stream === 'stderr' ? console.error : console.log)(line)),
        phase: options.phase ?? ((_id, run) => run())
    });

    return { host, state, serverOrigin };
};
