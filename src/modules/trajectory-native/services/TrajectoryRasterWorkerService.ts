import { logger } from '@/core/logger';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import type { DaemonJobReporterService, RasterJobStatus } from '@/modules/cloud-control/services/DaemonJobReporterService';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { RasterQueueJobPayload } from '@/shared/contracts';
import type { Job, Worker } from 'bullmq';
import type { RasterizerService } from './RasterizerService';

export class TrajectoryRasterWorkerService {
    private worker: Worker<RasterQueueJobPayload> | null = null;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly rasterizerService: RasterizerService,
        private readonly daemonJobReporterService?: DaemonJobReporterService
    ) {}

    start(): void {
        if (this.worker) {
            return;
        }

        this.worker = this.queueService.createWorker<RasterQueueJobPayload>(
            TRAJECTORY_RASTER_QUEUE_NAME,
            async (jobPayload, job) => this.processJob(jobPayload, job)
        );

        this.worker.on('failed', (job, error) => {
            logger.error(
                {
                    jobId: job?.data?.jobId,
                    err: error
                },
                'BullMQ trajectory raster job failed'
            );
        });

        logger.info('TrajectoryRasterWorkerService started');
    }

    async stop(): Promise<void> {
        if (!this.worker) {
            return;
        }

        await this.worker.close();
        this.worker = null;
        logger.info('TrajectoryRasterWorkerService stopped');
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
        if (!this.daemonJobReporterService) {
            return;
        }

        await this.daemonJobReporterService.reportRasterJobStatus({
            jobId: job.jobId,
            teamId: job.teamId,
            trajectoryId: job.trajectoryId,
            trajectoryName: job.trajectoryName,
            timestep: job.timestep,
            status,
            error,
            queueType: job.queueType
        }).catch((reportError: unknown) => {
            logger.error(
                {
                    jobId: job.jobId,
                    status,
                    err: reportError
                },
                'Failed to report trajectory raster job status'
            );
        });
    }

    private async processJob(job: RasterQueueJobPayload, bullJob: Job<RasterQueueJobPayload>): Promise<void> {
        const runningTimestamp = new Date().toISOString();

        try {
            await this.redisConnectionService.projectJobStatus(
                this.buildJobStatusProjection(job, 'running', runningTimestamp)
            );
            await this.reportJobStatus(job, 'running');

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
            await this.reportJobStatus(job, 'completed');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            const failedTimestamp = new Date().toISOString();

            await this.redisConnectionService.projectJobStatus(
                this.buildJobStatusProjection(job, 'failed', failedTimestamp, message)
            );
            await this.reportJobStatus(job, 'failed', message);

            throw error instanceof Error ? error : new Error(message);
        }
    }
}
