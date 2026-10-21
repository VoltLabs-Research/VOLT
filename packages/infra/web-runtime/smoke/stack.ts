// Stack smoke page: boots the server, provisions it with @volt/local-stack exactly as the desktop does,
// boots the daemon with the resulting enrollment, and waits until the server sees the cluster connected.
import { BackendHost } from '../src/host/BackendHost';
import Bootstrap from '@volt/local-stack/bootstrap';
import ServerApi from '@volt/local-stack/server-api';
import { DEFAULT_DAEMON_PORT, DEFAULT_SERVER_PORT, serverOriginFor } from '@volt/local-stack/defaults';
import { localDaemonEnv, localServerEnv, randomStackSecret } from '@volt/local-stack/stack-env';
import { waitForCluster } from '@volt/local-stack/wait-for-cluster';
import type { BootstrapState, BootstrapStore } from '@volt/local-stack/state';

const report = (step: string, value: unknown): void => console.log(`SMOKE ${step} ${JSON.stringify(value)}`);

const ports = { server: DEFAULT_SERVER_PORT, daemon: DEFAULT_DAEMON_PORT };

class MemoryStore implements BootstrapStore {
    private state: BootstrapState | null = null;
    async getBootstrap(): Promise<BootstrapState | null> { return this.state; }
    async setBootstrap(state: BootstrapState): Promise<void> { this.state = state; }
    async clearBootstrap(): Promise<void> { this.state = null; }
}

const run = async (): Promise<void> => {
    const host = new BackendHost();
    Object.assign(globalThis, { fetch: host.fetch });
    let daemonExit: number | null = null;
    host.onExit = (name, code) => {
        report('exit', { name, code });
        if(name === 'daemon'){
            daemonExit = code;
        }
    };

    await host.start({
        name: 'server',
        scriptUrl: new URL('../server.worker.js', import.meta.url),
        port: ports.server,
        boot: {
            env: localServerEnv({
                ports,
                dataDir: '/data/server',
                databasePath: '/data/server/server.sqlite',
                secrets: { secretKey: randomStackSecret(), sshKey: randomStackSecret() }
            }),
            argv: [],
            cwd: '/app/server',
            fs: { directory: 'volt-smoke-stack-server' },
            sqliteDirectory: '.volt-smoke-stack-server-sqlite'
        }
    });
    report('server', true);

    const log = (stream: string, line: string): void => console.log(`[${stream}] ${line}`);
    const bootstrap = await new Bootstrap({ store: new MemoryStore(), serverOrigin: serverOriginFor(ports.server), log }).ensure();
    report('bootstrap', { teamId: bootstrap.teamId, teamClusterId: bootstrap.teamClusterId });

    void host.start({
        name: 'daemon',
        scriptUrl: new URL('../daemon.worker.js', import.meta.url),
        port: ports.daemon,
        boot: {
            env: localDaemonEnv({ ports, dataDir: '/data/daemon', bootstrap }),
            argv: [],
            cwd: '/app/daemon',
            fs: { directory: 'volt-smoke-stack-daemon' },
            sqliteDirectory: '.volt-smoke-stack-daemon-sqlite'
        }
    }).catch((error: Error) => report('error', error.message));

    await waitForCluster(new ServerApi(serverOriginFor(ports.server)), bootstrap, {
        daemonFailure: () => daemonExit === null ? null : `daemon exited with ${daemonExit}`,
        logHint: 'See the worker console.'
    });
    report('cluster', 'connected');
    report('done', true);
};

run().catch((error: Error) => report('error', error.stack ?? error.message));
