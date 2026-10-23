import Bootstrap, { type ProvisionAccount } from './bootstrap';
import PluginSeeder from './plugin-seeder';
import ServerApi from './server-api';
import { waitForCluster } from './wait-for-cluster';
import type { BootstrapState, BootstrapStore, PluginSeedStore, ProvisioningLog } from './state';

// How the host starts the two backends; @volt/web-runtime starts them as workers of its page.
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

// The phases a host waits for before it serves the app. The default plugins install after it is up.
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
    }
];

// Runs one phase, reporting its progress the way the host shows it.
export type PhaseRunner = <T>(id: LocalStackPhaseId, run: () => Promise<T>) => Promise<T>;

// A stack that serves requests. Its default plugins are still installing: `plugins` settles once they
// are in, or once a failure is logged (the seeder retries what failed on the next start).
export interface ProvisionedLocalStack{
    state: BootstrapState;
    plugins: Promise<void>;
}

interface ProvisionProps{
    backends: LocalStackBackends;
    serverOrigin: string;
    store: BootstrapStore & PluginSeedStore;
    log: ProvisioningLog;
    phase: PhaseRunner;
    account?: ProvisionAccount;
}

// Brings a local stack up: the server, the workspace the bootstrap provisions on it and the daemon
// enrolled as its cluster. The default plugins for the platform the daemon reports install behind it,
// since a workspace is usable without them.
export const provisionLocalStack = async (props: ProvisionProps): Promise<ProvisionedLocalStack> => {
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

    const plugins = props.phase('plugins', () => new PluginSeeder({
        store: props.store,
        log: props.log,
        api
    }).ensure(state)).catch((error: unknown) => {
        props.log('stderr', `[plugins] ${error instanceof Error ? error.message : String(error)}`);
    });

    return { state, plugins };
};
