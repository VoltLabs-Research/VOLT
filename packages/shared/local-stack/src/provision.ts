import Bootstrap, { type ProvisionAccount } from './bootstrap';
import PluginSeeder from './plugin-seeder';
import ServerApi from './server-api';
import { waitForCluster } from './wait-for-cluster';
import type { BootstrapState, BootstrapStore, PluginSeedStore, ProvisioningLog } from './state';

// How a host runs the two backends: the desktop as Node processes, the browser as workers.
export interface LocalStackBackends{
    // Resolves once the server accepts requests.
    startServer(): Promise<void>;
    // Starts the daemon enrolled as the provisioned cluster; waiting for it to connect is shared.
    startDaemon(state: BootstrapState): Promise<void>;
    // Why the daemon has already stopped, or null while it runs.
    daemonFailure(): string | null;
    // Where to look when the daemon does not connect.
    logHint: string;
}

export type LocalStackPhaseId = 'server' | 'bootstrap' | 'daemon' | 'plugins';

export const LOCAL_STACK_PHASES: Array<{ id: LocalStackPhaseId; label: string }> = [
    {
        id: 'server',
        label: 'Start API server'
    },
    {
        id: 'bootstrap',
        label: 'Provision workspace'
    },
    {
        id: 'daemon',
        label: 'Start compute daemon'
    },
    {
        id: 'plugins',
        label: 'Install default plugins'
    }
];

// Runs one phase, reporting its progress the way the host shows it.
export type PhaseRunner = <T>(id: LocalStackPhaseId, run: () => Promise<T>) => Promise<T>;

interface ProvisionProps{
    backends: LocalStackBackends;
    serverOrigin: string;
    store: BootstrapStore & PluginSeedStore;
    log: ProvisioningLog;
    phase: PhaseRunner;
    account?: ProvisionAccount;
}

// Brings a local stack up: the server, the workspace the bootstrap provisions on it, the daemon
// enrolled as its cluster, and the default plugins for the platform the daemon reports.
export const provisionLocalStack = async (props: ProvisionProps): Promise<BootstrapState> => {
    const api = new ServerApi(props.serverOrigin);

    await props.phase('server', () => props.backends.startServer());

    const state = await props.phase('bootstrap', () => new Bootstrap({
        store: props.store,
        log: props.log,
        serverOrigin: props.serverOrigin,
        account: props.account
    }).ensure());

    await props.phase('daemon', async () => {
        await props.backends.startDaemon(state);
        await waitForCluster(api, state, {
            daemonFailure: () => props.backends.daemonFailure(),
            logHint: props.backends.logHint
        });
    });

    await props.phase('plugins', () => new PluginSeeder({
        store: props.store,
        log: props.log,
        api
    }).ensure(state));

    return state;
};
