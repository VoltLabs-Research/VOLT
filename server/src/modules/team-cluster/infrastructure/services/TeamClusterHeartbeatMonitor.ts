import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';

const TEAM_CLUSTER_HEARTBEAT_TIMEOUT_MS = readNumberEnv('TEAM_CLUSTER_HEARTBEAT_TIMEOUT_MS', 60_000);
const TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS = readNumberEnv('TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS', 15_000);
const TEAM_CLUSTER_DELETE_TIMEOUT_MS = readNumberEnv('TEAM_CLUSTER_DELETE_TIMEOUT_MS', 120_000);

@Singleton()
export default class TeamClusterHeartbeatMonitor {
    private interval?: NodeJS.Timeout;

    constructor(
        
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService
    ){}

    start(): void {
        if (this.interval) {
            return;
        }

        this.interval = setInterval(() => {
            this.runSweep().catch((error: unknown) => {
                logger.error(error, '[TeamClusterHeartbeatMonitor] Failed to sweep heartbeat timeouts');
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

    async runSweep(): Promise<void> {
        const heartbeatCutoff = new Date(Date.now() - TEAM_CLUSTER_HEARTBEAT_TIMEOUT_MS);
        const deleteCutoff = new Date(Date.now() - TEAM_CLUSTER_DELETE_TIMEOUT_MS);
        await Promise.all([
            this.teamClusterLifecycleService.markHeartbeatTimeouts(heartbeatCutoff),
            this.teamClusterLifecycleService.finalizeDeletingClustersByEvidence(heartbeatCutoff),
            this.teamClusterLifecycleService.markDeletingTimeouts(deleteCutoff)
        ]);
    }
};
