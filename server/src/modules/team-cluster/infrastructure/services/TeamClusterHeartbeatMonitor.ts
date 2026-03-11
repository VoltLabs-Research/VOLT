import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

const TEAM_CLUSTER_HEARTBEAT_TIMEOUT_MS = readNumberEnv('TEAM_CLUSTER_HEARTBEAT_TIMEOUT_MS', 60_000);
const TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS = readNumberEnv('TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS', 15_000);
const TEAM_CLUSTER_UPDATE_TIMEOUT_MS = readNumberEnv('TEAM_CLUSTER_UPDATE_TIMEOUT_MS', 120_000);

@injectable()
export default class TeamClusterHeartbeatMonitor {
    private interval?: NodeJS.Timeout;

    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
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

    async runSweep(): Promise<number> {
        const heartbeatCutoff = new Date(Date.now() - TEAM_CLUSTER_HEARTBEAT_TIMEOUT_MS);
        const updateCutoff = new Date(Date.now() - TEAM_CLUSTER_UPDATE_TIMEOUT_MS);
        const disconnectedClusters = await this.teamClusterLifecycleService.markHeartbeatTimeouts(heartbeatCutoff);
        const deletedClusters = await this.teamClusterLifecycleService.finalizeDeletingClustersByEvidence(heartbeatCutoff);
        const updateFailedClusters = await this.teamClusterLifecycleService.markUpdatingTimeouts(updateCutoff);

        return disconnectedClusters + deletedClusters + updateFailedClusters;
    }
};
