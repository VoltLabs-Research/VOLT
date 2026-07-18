import TeamClusterRepository from '@modules/cluster/repositories/TeamClusterRepository';
import demoClusterDeploymentService from '@modules/cluster/services/DemoClusterDeploymentService';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';

const TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS = readNumberEnv('TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS', 15_000);
const TEAM_CLUSTER_DELETE_TIMEOUT_MS = readNumberEnv('TEAM_CLUSTER_DELETE_TIMEOUT_MS', 120_000);

export class TeamClusterHeartbeatMonitor {
    private interval?: NodeJS.Timeout;
    private readonly teamClusterLifecycleService = teamClusterLifecycleService;
    private readonly teamClusterRepository = new TeamClusterRepository();
    private readonly demoClusterDeploymentService = demoClusterDeploymentService;

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

    async runSweep(): Promise<void> {
        const disconnectEvidenceCutoff = new Date(Date.now() - TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS);
        const deleteCutoff = new Date(Date.now() - TEAM_CLUSTER_DELETE_TIMEOUT_MS);
        await Promise.all([
            this.teamClusterLifecycleService.finalizeDeletingClustersByEvidence(disconnectEvidenceCutoff),
            this.teamClusterLifecycleService.markDeletingTimeouts(deleteCutoff),
            this.cleanupExpiredDemos()
        ]);
    }

    private async cleanupExpiredDemos(): Promise<void> {
        const expiredDemos = await this.teamClusterRepository.findExpiredDemos(new Date());
        if (expiredDemos.length === 0) {
            return;
        }

        await Promise.all(expiredDemos.map(async (demo) => {
            try {
                await this.teamClusterLifecycleService.markDeleting(demo.id);
            } catch (error: unknown) {
                logger.warn(`[TeamClusterHeartbeatMonitor] markDeleting failed for expired demo teamClusterId=${demo.id} error=${(error as Error).message}`);
            }

            const refreshed = await this.teamClusterRepository.findById(demo.id);
            const target = refreshed ?? demo;

            try {
                await this.demoClusterDeploymentService.teardownDemoStack(target);
                await this.teamClusterLifecycleService.deleteTeamCluster(target);
                logger.info(`[TeamClusterHeartbeatMonitor] Expired demo cleaned up teamClusterId=${target.id} teamId=${target.props.team}`);
            } catch (error: unknown) {
                logger.error(error, `[TeamClusterHeartbeatMonitor] Failed to clean up expired demo teamClusterId=${target.id} teamId=${target.props.team}`);
            }
        }));
    }
}

export default new TeamClusterHeartbeatMonitor();
