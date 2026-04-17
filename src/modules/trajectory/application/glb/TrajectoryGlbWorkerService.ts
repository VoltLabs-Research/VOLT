import { logger } from '@/core/logger';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { createMemoryAwareWorkerShell, delayJobWhenMemoryPressured } from '@/core/queues/infrastructure/memory-aware-worker';
import { delayJobOnQueueScopeContention, tryAcquireQueueScopeLease } from '@/core/queues/infrastructure/queue-scope-lease';
import type { MemoryAwareWorkerShell } from '@/core/queues/infrastructure/memory-aware-worker';
import type { QueueScopeLease } from '@/core/queues/infrastructure/queue-scope-lease';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';
import type { GlbConversionQueueJobPayload } from '@/contracts';
import { DelayedError } from 'bullmq';
import type { Job } from 'bullmq';
import type { GlbCompletedEventData } from '@/modules/trajectory/domain/events/glb/GlbCompletedEvent';
import type { GlbFailedEventData } from '@/modules/trajectory/domain/events/glb/GlbFailedEvent';
import type { GlbStartedEventData } from '@/modules/trajectory/domain/events/glb/GlbStartedEvent';
import type { GlbExporterService } from '@/modules/trajectory/application/glb/GlbExporterService';

interface GlbJobStatusReporter {
    reportGlbCompleted(input: GlbCompletedEventData): Promise<void>;
    reportGlbFailed(input: GlbFailedEventData): Promise<void>;
    reportGlbStarted(input: GlbStartedEventData): Promise<void>;
}

export class TrajectoryGlbWorkerService {
    private readonly workerShell: MemoryAwareWorkerShell<GlbConversionQueueJobPayload>;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly glbExporterService: GlbExporterService,
        private readonly daemonJobReporterService: GlbJobStatusReporter
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
        logger.info({ concurrency }, 'TrajectoryGlbWorkerService concurrency updated');
    }

    private async reportJobStatusBestEffort(
        job: GlbConversionQueueJobPayload,
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
                await this.daemonJobReporterService.reportGlbStarted(payload);
                return;
            }

            if (status === 'completed') {
                await this.daemonJobReporterService.reportGlbCompleted(payload);
                return;
            }

            if (!error) {
                throw new Error(`Missing failed GLB job error for ${job.jobId}`);
            }

            await this.daemonJobReporterService.reportGlbFailed({
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
            const trajectoryId = job.trajectoryId;

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
            if (blockingScope) {
                await delayJobOnQueueScopeContention(bullJob, {
                    queueName: TRAJECTORY_GLB_QUEUE_NAME,
                    jobId: job.jobId,
                    scope: blockingScope
                });
            }

            if (!queueScopeLease) {
                await delayJobOnQueueScopeContention(bullJob, {
                    queueName: TRAJECTORY_GLB_QUEUE_NAME,
                    jobId: job.jobId,
                    scope: {
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
        } catch (error) {
            if (error instanceof DelayedError) {
                throw error;
            }

            if (!(error instanceof Error)) {
                throw error;
            }

            this.reportJobStatusBestEffort(job, 'failed', error.message);

            throw error;
        } finally {
            if (queueScopeLease) {
                await queueScopeLease.release();
            }
        }
    }
}
