import { DelayedError, type Job } from 'bullmq';

import { logger } from '@/core/logger';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import type { QueueService } from '@/core/queues/application/QueueService';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { ObjectBucketName, type RasterQueueJobPayload } from '@/contracts';
import { isRecord } from '@/support/type-guards/is-record';
import type { Rasterizer } from '@/modules/trajectory/application/raster/Rasterizer';
import type { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';

export class TrajectoryRasterWorker extends BaseWorker<RasterQueueJobPayload> {
    protected readonly queueName = TRAJECTORY_RASTER_QUEUE_NAME;

    constructor(
        queueService: QueueService,
        private readonly trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore,
        private readonly rasterizer: Rasterizer,
        private readonly daemonJobReporter: DaemonJobReporter
    ) {
        super({ queueService });
    }

    protected async process(payload: RasterQueueJobPayload, bullJob: Job<RasterQueueJobPayload>): Promise<void> {
        let reachedTerminalStatus = false;

        try {
            this.reportStatus(payload, 'started');

            await bullJob.updateProgress(10);
            await this.rasterizer.rasterizePreview({
                inputBucket: ObjectBucketName.Models,
                inputObjectKey: payload.modelObjectKey,
                inputOwnerClusterId: payload.modelOwnerClusterId,
                outputObjectKey: payload.outputObjectKey,
                outputOwnerClusterId: payload.outputOwnerClusterId
            });
            await bullJob.updateProgress(100);

            this.reportStatus(payload, 'completed');
            reachedTerminalStatus = true;
        } catch (error) {
            if (error instanceof DelayedError || !(error instanceof Error)) {
                throw error;
            }

            this.reportStatus(payload, 'failed', error.message);
            reachedTerminalStatus = true;
            throw error;
        } finally {
            if (reachedTerminalStatus && isRecord(payload.metadata) && payload.metadata.autoPreview === true) {
                await this.trajectoryAutoPreviewClaimStore.releaseRasterization(payload.trajectoryId).catch((releaseError) => {
                    logger.error(
                        { err: releaseError, jobId: payload.jobId, trajectoryId: payload.trajectoryId },
                        'Failed to release trajectory auto-preview claim'
                    );
                });
            }
        }
    }

    private reportStatus(
        payload: RasterQueueJobPayload,
        status: 'started' | 'completed' | 'failed',
        error?: string
    ): void {
        const base = {
            jobId: payload.jobId,
            teamId: payload.teamId,
            trajectoryId: payload.trajectoryId,
            timestep: payload.timestep
        };
        const promise = status === 'started'
            ? this.daemonJobReporter.reportRasterStarted(base)
            : status === 'completed'
                ? this.daemonJobReporter.reportRasterCompleted(base)
                : this.daemonJobReporter.reportRasterFailed({ ...base, error: error! });

        promise.catch((reportError) => {
            logger.error(
                { err: reportError, jobId: payload.jobId, status, trajectoryId: payload.trajectoryId },
                'Failed to report trajectory raster job status'
            );
        });
    }
}
