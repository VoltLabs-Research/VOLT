import { getTrajectoryStorageCleanupTargets, type TrajectoryStorageCleanupTarget } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type ClusterTransferJobRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import type StoragePlacementRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';

@injectable()
export default class TrajectoryDeletedStorageCleanupEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementRepository)
        private readonly storagePlacementRepository: StoragePlacementRepository,

        @inject(TEAM_CLUSTER_TOKENS.ClusterTransferJobRepository)
        private readonly clusterTransferJobRepository: ClusterTransferJobRepository
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId, storageClusterId, teamCluster } = event.payload;
        const targets = getTrajectoryStorageCleanupTargets(trajectoryId);
        const resolvedStorageClusterId = storageClusterId ?? teamCluster;

        await Promise.all([
            this.cleanupLocalStorage(targets),
            resolvedStorageClusterId
                ? this.cleanupRemoteStorage(resolvedStorageClusterId, targets)
                : Promise.resolve(),
            this.storagePlacementRepository.deleteMany({
                scopeType: 'trajectory',
                scopeId: trajectoryId
            }),
            this.clusterTransferJobRepository.deleteMany({
                scopeType: 'trajectory',
                scopeId: trajectoryId
            })
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
            targets.map((target) => this.objectGatewayClient.deleteByPrefix(
                teamClusterId,
                target.bucket,
                target.prefix
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
