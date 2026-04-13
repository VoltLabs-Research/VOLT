import { logger } from '@/core/logger';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@/modules/platform/services';
import {
    createMemoryAwareWorkerShell,
    delayJobOnQueueScopeContention,
    delayJobWhenMemoryPressured,
    tryAcquireQueueScopeLease
} from '@/modules/platform/services';
import type { DaemonJobReporterService, GlbJobStatus } from '@/modules/cloud-control/services/DaemonJobReporterService';
import type {
    MemoryAwareWorkerShell,
    QueueScopeLease,
    QueueScopeLimitsRegistry,
    QueueService,
    RedisConnectionService
} from '@/modules/platform/services';
import type { GlbConversionQueueJobPayload } from '@/shared/contracts';
import { DelayedError } from 'bullmq';
import type { Job } from 'bullmq';
import type { GlbExporterService } from './GlbExporterService';

export class TrajectoryGlbWorkerService {
    private readonly workerShell: MemoryAwareWorkerShell<GlbConversionQueueJobPayload>;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly glbExporterService: GlbExporterService,
        private readonly daemonJobReporterService: DaemonJobReporterService
    ) {
        this.workerShell = createMemoryAwareWorkerShell<GlbConversionQueueJobPayload>({
            queueService: this.queueService,
            queueName: TRAJECTORY_GLB_QUEUE_NAME,
            startedMessage: 'TrajectoryGlbWorkerService started',
            stoppedMessage: 'TrajectoryGlbWorkerService stopped',
            failedMessage: 'BullMQ trajectory GLB conversion job failed'
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
        logger.info({ concurrency }, 'TrajectoryGlbWorkerService concurrency updated');
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
        await delayJobWhenMemoryPressured(bullJob, {
            jobId: job.jobId,
            message: 'Heap memory pressure detected — delaying GLB conversion job'
        });

        let queueScopeLease: QueueScopeLease | null = null;

        try {
            const trajectoryId = job.trajectoryId.trim();
            if (!trajectoryId) {
                throw new Error(`Missing trajectoryId for GLB conversion job ${job.jobId}`);
            }

            const queueScopeLimits = this.queueScopeLimitsRegistry.getSnapshot();
            const { lease, blockingScope } = await tryAcquireQueueScopeLease(
                this.redisConnectionService,
                TRAJECTORY_GLB_QUEUE_NAME,
                [
                    {
                        scope: 'trajectory',
                        scopeId: trajectoryId,
                        limit: queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory
                    },
                    {
                        scope: 'team',
                        scopeId: job.teamId,
                        limit: queueScopeLimits.trajectoryGlbConversion.maxRunningPerTeam
                    }
                ]
            );
            queueScopeLease = lease;
            if (!queueScopeLease || blockingScope) {
                await delayJobOnQueueScopeContention(bullJob, {
                    queueName: TRAJECTORY_GLB_QUEUE_NAME,
                    jobId: job.jobId,
                    scope: blockingScope ?? {
                        scope: 'trajectory',
                        scopeId: trajectoryId,
                        limit: queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory
                    }
                });
            }

            this.reportJobStatusBestEffort(job, 'running');

            await bullJob.updateProgress(10);
            await this.glbExporterService.preprocessTrajectory({
                trajectoryId: job.trajectoryId,
                timestep: job.timestep,
                objectKey: job.objectKey,
                ownerClusterId: job.ownerClusterId,
                teamId: job.teamId,
                trajectoryName: job.trajectoryName
            });
            await bullJob.updateProgress(100);

            this.reportJobStatusBestEffort(job, 'completed');
        } catch (error: unknown) {
            if (error instanceof DelayedError) {
                throw error;
            }

            const message = error instanceof Error ? error.message : String(error);
            this.reportJobStatusBestEffort(job, 'failed', message);

            throw error instanceof Error ? error : new Error(message);
        } finally {
            if (queueScopeLease) {
                await queueScopeLease.release();
            }
        }
    }
}
