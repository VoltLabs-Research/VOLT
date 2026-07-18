import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import StoragePlacementRepository from '@modules/cluster/repositories/StoragePlacementRepository';
import ClusterTransferJobRepository from '@modules/cluster/repositories/ClusterTransferJobRepository';
import TrajectoryDeletedEvent from '@modules/trajectory/events/trajectory/TrajectoryDeletedEvent';
import type { TrajectoryStorageCleanupTarget } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import { getTrajectoryStorageCleanupTargets } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedStorageCleanupEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    private readonly storagePlacementRepository = new StoragePlacementRepository();
    private readonly clusterTransferJobRepository = new ClusterTransferJobRepository();
    private readonly objectGatewayClient = objectGatewayClient;

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId, storageClusterId } = event.payload;
        const targets = getTrajectoryStorageCleanupTargets(trajectoryId);

        if (!storageClusterId) {
            logger.warn(
                `[TrajectoryDeletedStorageCleanupEventHandler] Skipping storage cleanup for trajectory ${trajectoryId} because no storage cluster is assigned`
            );
        }

        await Promise.all([
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
}
