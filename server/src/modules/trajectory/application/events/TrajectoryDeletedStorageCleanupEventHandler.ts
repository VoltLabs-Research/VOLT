import { getTrajectoryStorageCleanupTargets, type TrajectoryStorageCleanupTarget } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface ObjectDeleteResponse {
    deleted: boolean;
    deletedCount?: number;
};

@injectable()
export default class TrajectoryDeletedStorageCleanupEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId, teamCluster } = event.payload;
        const targets = getTrajectoryStorageCleanupTargets(trajectoryId);

        await Promise.all([
            this.cleanupLocalStorage(targets),
            teamCluster
                ? this.cleanupRemoteStorage(teamCluster, targets)
                : Promise.resolve()
        ]);
    }

    private async cleanupLocalStorage(targets: TrajectoryStorageCleanupTarget[]): Promise<void> {
        const results = await Promise.allSettled(
            targets.map((target) => this.storageService.deleteByPrefix(target.bucket, target.prefix))
        );

        this.logFailures('local', results, targets);
    }

    private async cleanupRemoteStorage(teamClusterId: string, targets: TrajectoryStorageCleanupTarget[]): Promise<void> {
        const results = await Promise.allSettled(
            targets.map((target) => this.teamClusterDaemonClient.command<ObjectDeleteResponse>(
                teamClusterId,
                TEAM_CLUSTER_DAEMON_COMMAND.object.delete,
                {
                    bucket: target.bucket,
                    prefix: target.prefix
                }
            ))
        );

        this.logFailures(`team cluster ${teamClusterId}`, results, targets);
    }

    private logFailures(
        targetName: string,
        results: PromiseSettledResult<unknown>[],
        targets: TrajectoryStorageCleanupTarget[]
    ): void {
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                return;
            }

            const target = targets[index];
            logger.warn(
                result.reason,
                `[TrajectoryDeletedStorageCleanupEventHandler] Failed to delete ${targetName} storage prefix ${target.bucket}/${target.prefix}`
            );
        });
    }
};
