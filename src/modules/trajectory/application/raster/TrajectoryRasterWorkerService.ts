import { logger } from '@/core/logger';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { createMemoryAwareWorkerShell, delayJobWhenMemoryPressured } from '@/core/queues/infrastructure/memory-aware-worker';
import { ObjectBucketName } from '@/contracts';
import type { MemoryAwareWorkerShell } from '@/core/queues/infrastructure/memory-aware-worker';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { RasterQueueJobPayload } from '@/contracts';
import { isRecord } from '@/support/type-guards/isRecord';
import { DelayedError } from 'bullmq';
import type { Job } from 'bullmq';
import type { RasterCompletedEventData } from '@/modules/trajectory/domain/events/raster/RasterCompletedEvent';
import type { RasterFailedEventData } from '@/modules/trajectory/domain/events/raster/RasterFailedEvent';
import type { RasterStartedEventData } from '@/modules/trajectory/domain/events/raster/RasterStartedEvent';
import type { RasterizerService } from '@/modules/trajectory/application/raster/RasterizerService';
import type { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';

interface RasterJobStatusReporter {
    reportRasterCompleted(input: RasterCompletedEventData): Promise<void>;
    reportRasterFailed(input: RasterFailedEventData): Promise<void>;
    reportRasterStarted(input: RasterStartedEventData): Promise<void>;
}

export class TrajectoryRasterWorkerService {
    private readonly workerShell: MemoryAwareWorkerShell<RasterQueueJobPayload>;

    constructor(
        private readonly queueService: QueueService,
        private readonly trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore,
        private readonly rasterizerService: RasterizerService,
        private readonly daemonJobReporterService: RasterJobStatusReporter
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
            (jobPayload, job) => this.processJob(jobPayload, job),
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
        status: 'running' | 'completed' | 'failed',
        error?: string
    ): Promise<void> {
        try {
            const payload = {
                jobId: job.jobId,
                teamId: job.teamId,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                timestep: job.timestep,
                ...(error ? { error } : {})
            };

            if (status === 'running') {
                await this.daemonJobReporterService.reportRasterStarted(payload);
                return;
            }

            if (status === 'completed') {
                await this.daemonJobReporterService.reportRasterCompleted(payload);
                return;
            }

            if (!error) {
                throw new Error(`Missing failed raster job error for ${job.jobId}`);
            }

            await this.daemonJobReporterService.reportRasterFailed({
                ...payload,
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
        } catch (error) {
            if (error instanceof DelayedError) {
                throw error;
            }

            if (!(error instanceof Error)) {
                throw error;
            }

            this.reportJobStatusBestEffort(job, 'failed', error.message);
            shouldReleaseAutoPreviewClaim = true;

            throw error;
        } finally {
            if (!shouldReleaseAutoPreviewClaim || !isRecord(job.metadata) || job.metadata.autoPreview !== true) {
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
