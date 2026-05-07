import type { TeamClusterQueueConcurrencyProps } from '@modules/cluster/domain/entities/TeamCluster';
import CloudUploadQueueService from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadQueueService';
import CompressionQueueService from '@modules/trajectory/infrastructure/services/trajectory/CompressionQueueService';
import TrajectoryBackgroundProcessor from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryBackgroundProcessor';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

/**
 * Applies queueConcurrency settings to the queues that live IN the volt-server
 * process (compression, cloud upload, background trajectory parsing). The
 * daemon-side queues are handled by the daemon's own QueueConcurrencyCoordinator
 * via the runtime.queue-concurrency.apply channel command.
 */
@Singleton()
export default class ServerSideQueueConcurrencyCoordinator {
    constructor(
        private readonly compressionQueueService: CompressionQueueService,
        private readonly cloudUploadQueueService: CloudUploadQueueService,
        private readonly trajectoryBackgroundProcessor: TrajectoryBackgroundProcessor
    ) {}

    apply(queueConcurrency: TeamClusterQueueConcurrencyProps): void {
        try {
            this.compressionQueueService.setConcurrency(queueConcurrency.trajectoryCompression);
            this.cloudUploadQueueService.setConcurrency(queueConcurrency.cloudUpload);
            this.trajectoryBackgroundProcessor.setConcurrency(queueConcurrency.trajectoryBackgroundProcessor);
            logger.info({
                trajectoryCompression: queueConcurrency.trajectoryCompression,
                cloudUpload: queueConcurrency.cloudUpload,
                trajectoryBackgroundProcessor: queueConcurrency.trajectoryBackgroundProcessor
            }, '[ServerSideQueueConcurrencyCoordinator] applied');
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
            trajectoryCompression: this.compressionQueueService.getConcurrency(),
            cloudUpload: this.cloudUploadQueueService.getConcurrency(),
            trajectoryBackgroundProcessor: this.trajectoryBackgroundProcessor.getConcurrency()
        };
    }
}
