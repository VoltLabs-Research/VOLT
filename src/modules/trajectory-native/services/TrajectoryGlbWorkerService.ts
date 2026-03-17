import { logger } from '@/core/logger';
import { isMemoryPressured } from '@/core/memory';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@/modules/platform/services';
import type { DaemonJobReporterService, GlbJobStatus } from '@/modules/cloud-control/services/DaemonJobReporterService';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { GlbConversionQueueJobPayload } from '@/shared/contracts';
import { DelayedError, type Job, type Worker } from 'bullmq';
import type { GlbExporterService } from './GlbExporterService';

export class TrajectoryGlbWorkerService {
    private worker: Worker<GlbConversionQueueJobPayload> | null = null;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly glbExporterService: GlbExporterService,
        private readonly daemonJobReporterService: DaemonJobReporterService
    ) {}

    start(concurrency?: number): void {
        if (this.worker) {
            return;
        }

        this.worker = this.queueService.createWorker<GlbConversionQueueJobPayload>(
            TRAJECTORY_GLB_QUEUE_NAME,
            async (jobPayload, job) => this.processJob(jobPayload, job),
            { concurrency: concurrency ?? 3 }
        );

        this.worker.on('failed', (job, error) => {
            logger.error(
                {
                    jobId: job?.data?.jobId,
                    err: error
                },
                'BullMQ trajectory GLB conversion job failed'
            );
        });

        logger.info('TrajectoryGlbWorkerService started');
    }

    async stop(): Promise<void> {
        if (!this.worker) {
            return;
        }

        await this.worker.close();
        this.worker = null;
        logger.info('TrajectoryGlbWorkerService stopped');
    }

    private buildJobStatusProjection(
        job: GlbConversionQueueJobPayload,
        status: 'running' | 'completed' | 'failed',
        timestamp: string,
        error?: string
    ): GlbConversionQueueJobPayload & { timestamp: string; } {
        return {
            jobId: job.jobId,
            teamId: job.teamId,
            trajectoryId: job.trajectoryId,
            trajectoryName: job.trajectoryName,
            timestep: job.timestep,
            objectKey: job.objectKey,
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
        job: GlbConversionQueueJobPayload,
        status: GlbJobStatus,
        error?: string
    ): Promise<void> {
        await this.daemonJobReporterService.reportGlbJobStatus({
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
        job: GlbConversionQueueJobPayload,
        status: GlbJobStatus,
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
                'Failed to report trajectory GLB job status to cloud control'
            );
        }
    }

    private async processJob(job: GlbConversionQueueJobPayload, bullJob: Job<GlbConversionQueueJobPayload>): Promise<void> {
        // Memory-aware scheduling: requeue with delay if heap is under pressure
        if (isMemoryPressured()) {
            const delayMs = 30_000;
            logger.warn(
                { jobId: job.jobId, delayMs },
                'Heap memory pressure detected — delaying GLB conversion job'
            );
            await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
            throw new DelayedError();
        }

        const runningTimestamp = new Date().toISOString();

        try {
            await this.redisConnectionService.projectJobStatus(
                this.buildJobStatusProjection(job, 'running', runningTimestamp)
            );
            await this.reportJobStatusBestEffort(job, 'running');

            await bullJob.updateProgress(10);
            await this.glbExporterService.preprocessTrajectory({
                trajectoryId: job.trajectoryId,
                timestep: job.timestep,
                objectKey: job.objectKey,
                teamId: job.teamId,
                trajectoryName: job.trajectoryName
            });
            await bullJob.updateProgress(100);

            const completedTimestamp = new Date().toISOString();
            await this.redisConnectionService.projectJobStatus(
                this.buildJobStatusProjection(job, 'completed', completedTimestamp)
            );
            await this.reportJobStatusBestEffort(job, 'completed');
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

            throw error instanceof Error ? error : new Error(message);
        }
    }
}
