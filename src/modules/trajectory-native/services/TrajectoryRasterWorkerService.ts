import { logger } from '@/core/logger';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/modules/platform/services';
import { createMemoryAwareWorkerShell, delayJobWhenMemoryPressured, type MemoryAwareWorkerShell } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import type { DaemonJobReporterService, RasterJobStatus } from '@/modules/cloud-control/services/DaemonJobReporterService';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { RasterQueueJobPayload } from '@/shared/contracts';
import { isRecord } from '@/shared/utilities/type-guards';
import { DelayedError, type Job } from 'bullmq';
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
        private readonly redisConnectionService: RedisConnectionService,
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

    private buildJobStatusProjection(
        job: RasterQueueJobPayload,
        status: 'running' | 'completed' | 'failed',
        timestamp: string,
        error?: string
    ): RasterQueueJobPayload & { timestamp: string; } {
        return {
            jobId: job.jobId,
            teamId: job.teamId,
            trajectoryId: job.trajectoryId,
            trajectoryName: job.trajectoryName,
            timestep: job.timestep,
            modelObjectKey: job.modelObjectKey,
            outputObjectKey: job.outputObjectKey,
            status,
            queueType: job.queueType,
            metadata: job.metadata,
            error,
            createdAt: job.createdAt,
            updatedAt: timestamp,
            timestamp
        };
    }

    private async reportJobStatus(
        job: RasterQueueJobPayload,
        status: RasterJobStatus,
        error?: string
    ): Promise<void> {
        await this.daemonJobReporterService.reportRasterJobStatus({
            jobId: job.jobId,
            teamId: job.teamId,
            trajectoryId: job.trajectoryId,
            trajectoryName: job.trajectoryName,
            timestep: job.timestep,
            status,
            error
        });
    }

    private async reportJobStatusBestEffort(
        job: RasterQueueJobPayload,
        status: RasterJobStatus,
        error?: string
    ): Promise<void> {
        try {
            await this.reportJobStatus(job, status, error);
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

        const runningTimestamp = new Date().toISOString();
        let shouldReleaseAutoPreviewClaim = false;

        try {
            await this.redisConnectionService.projectJobStatus(
                this.buildJobStatusProjection(job, 'running', runningTimestamp)
            );
            await this.reportJobStatusBestEffort(job, 'running');

            await bullJob.updateProgress(10);
            await this.rasterizerService.rasterizePreview({
                inputBucket: ObjectBucketName.Models,
                inputObjectKey: job.modelObjectKey,
                outputObjectKey: job.outputObjectKey
            });
            await bullJob.updateProgress(100);

            const completedTimestamp = new Date().toISOString();
            await this.redisConnectionService.projectJobStatus(
                this.buildJobStatusProjection(job, 'completed', completedTimestamp)
            );
            await this.reportJobStatusBestEffort(job, 'completed');
            shouldReleaseAutoPreviewClaim = true;
        } catch (error: unknown) {
            if (error instanceof DelayedError) {
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            const failedTimestamp = new Date().toISOString();

            await this.redisConnectionService.projectJobStatus(
                this.buildJobStatusProjection(job, 'failed', failedTimestamp, message)
            );
            await this.reportJobStatusBestEffort(job, 'failed', message);
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
