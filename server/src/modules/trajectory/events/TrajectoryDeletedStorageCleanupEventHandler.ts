import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import StoragePlacementModel from '@modules/cluster/models/StoragePlacementModel';
import ClusterTransferJobModel from '@modules/cluster/models/ClusterTransferJobModel';
import TrajectoryDeletedEvent from '@modules/trajectory/events/trajectory/TrajectoryDeletedEvent';
import type { TrajectoryStorageCleanupTarget } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import { getTrajectoryStorageCleanupTargets } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';
import logger from '@shared/infrastructure/logger';

class TrajectoryDeletedStorageCleanupEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
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
            StoragePlacementModel.deleteMany({
                scopeType: 'trajectory',
                scopeId: trajectoryId
            }).exec(),
            ClusterTransferJobModel.deleteMany({
                scopeType: 'trajectory',
                scopeId: trajectoryId
            }).exec()
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

const trajectoryDeletedStorageCleanupEventHandler = new TrajectoryDeletedStorageCleanupEventHandler();
subscribeHandler('trajectory.deleted', trajectoryDeletedStorageCleanupEventHandler);

export default trajectoryDeletedStorageCleanupEventHandler;
