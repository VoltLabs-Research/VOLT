import { getAnalysisStorageCleanupTargets, type AnalysisStorageCleanupTarget } from '@modules/analysis/utilities/storage-cleanup-prefixes';
import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
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
export default class AnalysisDeletedStorageCleanupEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId, trajectoryId, teamClusterId } = event.payload;
        const targets = getAnalysisStorageCleanupTargets(trajectoryId, analysisId);

        await Promise.all([
            this.cleanupLocalStorage(targets),
            teamClusterId
                ? this.cleanupRemoteStorage(teamClusterId, targets)
                : Promise.resolve()
        ]);
    }

    private async cleanupLocalStorage(targets: AnalysisStorageCleanupTarget[]): Promise<void> {
        const results = await Promise.allSettled(
            targets.map((target) => this.storageService.deleteByPrefix(target.bucket, target.prefix))
        );

        this.logFailures('local', results, targets);
    }

    private async cleanupRemoteStorage(
        teamClusterId: string,
        targets: AnalysisStorageCleanupTarget[]
    ): Promise<void> {
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
        targets: AnalysisStorageCleanupTarget[]
    ): void {
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                return;
            }

            const target = targets[index];
            logger.warn(
                result.reason,
                `[AnalysisDeletedStorageCleanupEventHandler] Failed to delete ${targetName} storage prefix ${target.bucket}/${target.prefix}`
            );
        });
    }
}
