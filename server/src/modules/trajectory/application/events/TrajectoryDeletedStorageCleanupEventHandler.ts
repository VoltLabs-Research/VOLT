import ClusterTransferJobRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import StoragePlacementRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import type { TrajectoryStorageCleanupTarget } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import { getTrajectoryStorageCleanupTargets } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedStorageCleanupEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,

        
        private readonly storagePlacementRepository: StoragePlacementRepository,

        
        private readonly clusterTransferJobRepository: ClusterTransferJobRepository
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId, storageClusterId } = event.payload;
        const targets = getTrajectoryStorageCleanupTargets(trajectoryId);

        await Promise.all([
            this.cleanupLocalStorage(targets),
            storageClusterId
                ? this.cleanupRemoteStorage(storageClusterId, targets)
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
