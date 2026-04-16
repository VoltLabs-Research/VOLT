import { logger } from '@/core/logger';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/modules/platform/services';
import { createMemoryAwareWorkerShell, delayJobWhenMemoryPressured } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import type { DaemonJobReporterService, RasterJobStatus } from '@/modules/cloud-control/services/DaemonJobReporterService';
import type { MemoryAwareWorkerShell, QueueService } from '@/modules/platform/services';
import type { RasterQueueJobPayload } from '@/shared/contracts';
import { isRecord } from '@/shared/utilities/type-guards';
import { DelayedError } from 'bullmq';
import type { Job } from 'bullmq';
import type { RasterizerService } from './RasterizerService';
import type { TrajectoryAutoPreviewClaimStore } from './TrajectoryAutoPreviewClaimStore';

const isAutoPreviewRasterJob = (job: RasterQueueJobPayload): boolean => {
    if (!isRecord(job.metadata)) {
        return false;
    }

    return job.metadata.autoPreview === true;
};

export class TrajectoryRasterWorkerService {
    private readonly workerShell: MemoryAwareWorkerShell<RasterQueueJobPayload>;

    constructor(
        private readonly queueService: QueueService,
        private readonly trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore,
        private readonly rasterizerService: RasterizerService,
        private readonly daemonJobReporterService: DaemonJobReporterService
    ) {
        this.workerShell = createMemoryAwareWorkerShell<RasterQueueJobPayload>({
            queueService: this.queueService,
            queueName: TRAJECTORY_RASTER_QUEUE_NAME,
            startedMessage: 'TrajectoryRasterWorkerService started',
            stoppedMessage: 'TrajectoryRasterWorkerService stopped',
            failedMessage: 'BullMQ trajectory raster job failed'
        });
    }

    start(concurrency?: number): void {
        this.workerShell.start(
            async (jobPayload, job) => this.processJob(jobPayload, job),
            {
                concurrency
            }
        );
    }

    async stop(): Promise<void> {
        await this.workerShell.stop();
    }

    setConcurrency(concurrency: number): void {
        this.workerShell.setConcurrency(concurrency);
        logger.info({ concurrency }, 'TrajectoryRasterWorkerService concurrency updated');
    }

    private async reportJobStatusBestEffort(
        job: RasterQueueJobPayload,
        status: RasterJobStatus,
        error?: string
    ): Promise<void> {
        try {
            await this.daemonJobReporterService.reportRasterJobStatus({
                jobId: job.jobId,
                teamId: job.teamId,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                timestep: job.timestep,
                status,
                error
            });
        } catch (reportError) {
            logger.error(
                {
                    err: reportError,
                    jobId: job.jobId,
                    status,
                    trajectoryId: job.trajectoryId
                },
                'Failed to report trajectory raster job status to cloud control'
            );
        }
    }

    private async processJob(job: RasterQueueJobPayload, bullJob: Job<RasterQueueJobPayload>): Promise<void> {
        await delayJobWhenMemoryPressured(bullJob, {
            jobId: job.jobId,
            message: 'Heap memory pressure detected — delaying raster job'
        });

        let shouldReleaseAutoPreviewClaim = false;

        try {
            this.reportJobStatusBestEffort(job, 'running');

            await bullJob.updateProgress(10);
            await this.rasterizerService.rasterizePreview({
                inputBucket: ObjectBucketName.Models,
                inputObjectKey: job.modelObjectKey,
                inputOwnerClusterId: job.modelOwnerClusterId,
                outputObjectKey: job.outputObjectKey,
                outputOwnerClusterId: job.outputOwnerClusterId
            });
            await bullJob.updateProgress(100);

            this.reportJobStatusBestEffort(job, 'completed');
            shouldReleaseAutoPreviewClaim = true;
        } catch (error: unknown) {
            if (error instanceof DelayedError) {
                throw error;
            }

            const message = error instanceof Error ? error.message : String(error);
            this.reportJobStatusBestEffort(job, 'failed', message);
            shouldReleaseAutoPreviewClaim = true;

            throw error instanceof Error ? error : new Error(message);
        } finally {
            if (!shouldReleaseAutoPreviewClaim || !isAutoPreviewRasterJob(job)) {
                return;
            }

            try {
                await this.trajectoryAutoPreviewClaimStore.releaseRasterization(job.trajectoryId);
            } catch (releaseError) {
                logger.error(
                    {
                        err: releaseError,
                        jobId: job.jobId,
                        trajectoryId: job.trajectoryId
                    },
                    'Failed to release trajectory auto-preview claim after terminal raster job exit'
                );
            }
        }
    }
}
