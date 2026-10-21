import { teamClusterRoutes } from '@volt/contracts/modules/cluster/routes';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import type ServerApi from './server-api';
import type { BootstrapState } from './state';

interface ClusterView{
    teamCluster?: {
        status?: string;
        hostCapabilities?: { platform?: string | null } | null;
    };
    status?: string;
}

const DAEMON_CONNECT_TIMEOUT_MS = 120_000;
const DAEMON_POLL_MS = 1_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Resolves once the provisioned cluster's daemon is connected and has reported its host platform,
// which the plugin seed installs binaries for. `daemonFailure` reports a daemon that already ended.
export const waitForCluster = async (
    api: ServerApi,
    state: BootstrapState,
    options: { daemonFailure: () => string | null; logHint: string }
): Promise<void> => {
    const deadline = Date.now() + DAEMON_CONNECT_TIMEOUT_MS;
    let lastStatus = 'unknown';

    while(Date.now() < deadline){
        const failure = options.daemonFailure();
        if(failure) throw new Error(failure);

        try{
            const view = await api.request<ClusterView>(teamClusterRoutes.getById, {
                params: {
                    teamId: state.teamId,
                    teamClusterId: state.teamClusterId
                },
                token: state.authToken
            });
            lastStatus = view.teamCluster?.status ?? view.status ?? lastStatus;
            if(lastStatus === TeamClusterStatus.Connected && view.teamCluster?.hostCapabilities?.platform) return;
        }catch(err){
            lastStatus = `unreachable (${errorMessage(err)})`;
        }

        await sleep(DAEMON_POLL_MS);
    }

    throw new Error(`The compute daemon did not connect within ${DAEMON_CONNECT_TIMEOUT_MS / 1000}s (last status: ${lastStatus}). ${options.logHint}`);
};
