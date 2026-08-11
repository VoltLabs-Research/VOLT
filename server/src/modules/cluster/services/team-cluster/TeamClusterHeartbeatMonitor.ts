import teamClusterLifecycleService from '@modules/cluster/services/team-cluster/TeamClusterLifecycleService';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';

const TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS = readNumberEnv('TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS', 15_000);
const TEAM_CLUSTER_DELETE_TIMEOUT_MS = readNumberEnv('TEAM_CLUSTER_DELETE_TIMEOUT_MS', 120_000);

class TeamClusterHeartbeatMonitor {
    private interval?: NodeJS.Timeout;

    start(): void {
        if (this.interval) {
            return;
        }

        this.interval = setInterval(() => {
            this.runSweep().catch((error: unknown) => {
                logger.error(error, '[TeamClusterHeartbeatMonitor] Failed to sweep cluster lifecycle');
            });
        }, TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS);
    }

    stop(): void {
        if (!this.interval) {
            return;
        }

        clearInterval(this.interval);
        this.interval = undefined;
    }

    private async runSweep(): Promise<void> {
        const disconnectEvidenceCutoff = new Date(Date.now() - TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS);
        const deleteCutoff = new Date(Date.now() - TEAM_CLUSTER_DELETE_TIMEOUT_MS);
        await Promise.all([
            teamClusterLifecycleService.finalizeDeletingClustersByEvidence(disconnectEvidenceCutoff),
            teamClusterLifecycleService.markDeletingTimeouts(deleteCutoff)
        ]);
    }
}

export default new TeamClusterHeartbeatMonitor();
