import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike } from '@modules/cluster/contracts/domain/team-cluster';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import demoClusterDeploymentService from '@modules/cluster/services/DemoClusterDeploymentService';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import { LessThanOrEqual, Not, In } from 'typeorm';

const TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS = readNumberEnv('TEAM_CLUSTER_HEARTBEAT_SWEEP_INTERVAL_MS', 15_000);
const TEAM_CLUSTER_DELETE_TIMEOUT_MS = readNumberEnv('TEAM_CLUSTER_DELETE_TIMEOUT_MS', 120_000);

export class TeamClusterHeartbeatMonitor {
    private interval?: NodeJS.Timeout;
    private readonly teamClusterLifecycleService = teamClusterLifecycleService;
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
        const now = new Date();
        const expiredDemoEntities = await TeamClusterEntity.findBy({
            isDemo: true,
            demoExpiresAt: LessThanOrEqual(now),
            status: Not(In([TeamClusterStatus.Deleting, TeamClusterStatus.DeleteFailed]))
        });
        const expiredDemos = expiredDemoEntities.map(toTeamClusterLike);
        if (expiredDemos.length === 0) {
            return;
        }

        await Promise.all(expiredDemos.map(async (demo) => {
            try {
                await this.teamClusterLifecycleService.markDeleting(demo.id);
            } catch (error: unknown) {
                logger.warn(`[TeamClusterHeartbeatMonitor] markDeleting failed for expired demo teamClusterId=${demo.id} error=${(error as Error).message}`);
            }

            const refreshedEntity = await TeamClusterEntity.findOneBy({ id: demo.id });
            const target = refreshedEntity ? toTeamClusterLike(refreshedEntity) : demo;

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
