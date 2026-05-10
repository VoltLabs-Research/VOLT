import type { TeamClusterQueueConcurrencyProps } from '@modules/cluster/domain/entities/TeamCluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

/**
 * Applies queueConcurrency settings to the queues that live IN the volt-server
 * process. With the new streaming pipeline, the server no longer manages local
 * compression or upload queues — those responsibilities are handled by the daemon.
 * This coordinator is kept as a no-op anchor so that callers do not break; it
 * only logs the received settings.
 */
@Singleton()
export default class ServerSideQueueConcurrencyCoordinator {
    constructor() {}

    apply(queueConcurrency: TeamClusterQueueConcurrencyProps): void {
        try {
            logger.info({
                trajectoryCompression: queueConcurrency.trajectoryCompression,
                cloudUpload: queueConcurrency.cloudUpload,
                trajectoryBackgroundProcessor: queueConcurrency.trajectoryBackgroundProcessor
            }, '[ServerSideQueueConcurrencyCoordinator] received (no-op — queues moved to daemon)');
        } catch (error: unknown) {
            logger.warn(error, '[ServerSideQueueConcurrencyCoordinator] failed to apply concurrency');
        }
    }

    snapshot(): {
        trajectoryCompression: number;
        cloudUpload: number;
        trajectoryBackgroundProcessor: number;
    } {
        return {
            trajectoryCompression: 0,
            cloudUpload: 0,
            trajectoryBackgroundProcessor: 0
        };
    }
}
