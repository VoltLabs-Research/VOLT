import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import DemoClusterDeploymentService from '@modules/cluster/infrastructure/services/DemoClusterDeploymentService';
import TeamClusterLifecycleService from '@modules/cluster/infrastructure/services/TeamClusterLifecycleService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';

const TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS = readNumberEnv('TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS', 15_000);
const TEAM_CLUSTER_DELETE_TIMEOUT_MS = readNumberEnv('TEAM_CLUSTER_DELETE_TIMEOUT_MS', 120_000);

@Singleton()
export default class TeamClusterHeartbeatMonitor {
    private interval?: NodeJS.Timeout;

    constructor(
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly demoClusterDeploymentService: DemoClusterDeploymentService
    ){}

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
