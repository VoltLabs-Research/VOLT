import { getRedisConfig, createBullMQRedisConnectionOptions } from '@core/config/redis';
import { getTrajectoryCompressionQueueConcurrency } from '@core/config/trajectory';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { IEventBus } from '@shared/application/events/IEventBus';
import CompressionProcessor from './CompressionProcessor';
import {
    delayJobOnQueueScopeContention,
    tryAcquireQueueScopeLease,
    type QueueScopeLease
} from './queue-scope-lease';
import TeamClusterQueueScopeLimitsService from './TeamClusterQueueScopeLimitsService';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import { DelayedError, Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { v4 as uuid } from 'uuid';
import IORedis from 'ioredis';
import type { JobStatusChangedValue } from '@modules/jobs/domain/events/JobStatusChangedEvent';

const QUEUE_NAME = 'trajectory_compression';
const QUEUE_TYPE = 'trajectory_compression';
const SESSION_TTL_SECONDS = 86400;

export interface CompressionJobData {
    jobId: string;
    trajectoryId: string;
    teamId: string;
    teamClusterId: string;
    trajectoryName: string;
    timestep: number;
    sourceFramePath: string;
    compressedFramePath: string;
    objectKey: string;
    compressionCodec: 'zstd';
    contentType: string;
    contentEncoding?: string;
}

export type CompressionSessionDrainCallback = (
    trajectoryId: string,
    teamId: string,
    teamClusterId: string,
    trajectoryName: string,
    failedCount: number,
    successfulJobs: CompressionJobData[]
) => Promise<void>;

@injectable()
export default class CompressionQueueService {
    private queue: Queue | null = null;
    private worker: Worker | null = null;
    private drainCallback: CompressionSessionDrainCallback | null = null;

    constructor(
        @inject(TRAJECTORY_TOKENS.CompressionProcessor)
        private readonly compressionProcessor: CompressionProcessor,

        @inject(TRAJECTORY_TOKENS.TeamClusterQueueScopeLimitsService)
        private readonly teamClusterQueueScopeLimitsService: TeamClusterQueueScopeLimitsService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    public onSessionDrain(callback: CompressionSessionDrainCallback): void {
        this.drainCallback = callback;
    }

    public start(): void {
        if (this.queue) return;

        const connection = createBullMQRedisConnectionOptions(getRedisConfig());
        const concurrency = getTrajectoryCompressionQueueConcurrency();

        this.queue = new Queue(QUEUE_NAME, {
            connection,
            defaultJobOptions: {
                removeOnComplete: { count: 500 },
                removeOnFail: { count: 200 },
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                }
            }
        });

        this.worker = new Worker<CompressionJobData>(
            QUEUE_NAME,
            async (job) => {
                let queueScopeLease: QueueScopeLease | null = null;

                try {
                    const trajectoryId = job.data.trajectoryId.trim();
                    if (!trajectoryId) {
                        throw new Error(`Missing trajectoryId for compression job ${job.data.jobId}`);
                    }

                    const queueScopeLimits = await this.teamClusterQueueScopeLimitsService.getLimits(
                        job.data.teamClusterId,
                        'trajectoryCompression'
                    );
                    const { lease, blockingScope } = await tryAcquireQueueScopeLease(
                        this.redis,
                        QUEUE_NAME,
                        [
                            {
                                scope: 'trajectory',
                                scopeId: trajectoryId,
                                limit: queueScopeLimits.maxRunningPerTrajectory
                            },
                            {
                                scope: 'team',
                                scopeId: job.data.teamId,
                                limit: queueScopeLimits.maxRunningPerTeam
                            }
                        ]
                    );
                    queueScopeLease = lease;
                    if (!queueScopeLease || blockingScope) {
                        await delayJobOnQueueScopeContention(job, {
                            queueName: QUEUE_NAME,
                            jobId: job.data.jobId,
                            scope: blockingScope ?? {
                                scope: 'trajectory',
                                scopeId: trajectoryId,
                                limit: queueScopeLimits.maxRunningPerTrajectory
                            }
                        });
                    }

                    await this.publishStatus(job.data.jobId, job.data.teamId, JobStatus.Running, {
                        trajectoryId,
                        trajectoryName: job.data.trajectoryName,
                        timestep: job.data.timestep,
                        message: 'Compressing frame with zstd'
                    });

                    await this.compressionProcessor.process(job.data);
                    return job.data;
                } finally {
                    if (queueScopeLease) {
                        await queueScopeLease.release();
                    }
                }
            },
            {
                connection,
                concurrency,
                removeOnComplete: { count: 500 },
                removeOnFail: { count: 200 }
            }
        );

        this.worker.on('completed', async (job) => {
            await this.runListenerStep('publish completed compression status', async () => {
                await this.publishStatus(job.data.jobId, job.data.teamId, JobStatus.Completed, {
                    trajectoryId: job.data.trajectoryId,
                    trajectoryName: job.data.trajectoryName,
                    timestep: job.data.timestep,
                    compressedFramePath: job.data.compressedFramePath,
                    objectKey: job.data.objectKey,
                    compressionCodec: job.data.compressionCodec
                });
            });

            await this.runListenerStep('track successful compression job', async () => {
                await this.trackSuccessfulJob(job.data);
            });

            await this.runListenerStep('decrement compression session', async () => {
                await this.decrementSession(job.data);
            });
        });

        this.worker.on('failed', async (job, error) => {
            if (!job) return;
            if (error instanceof DelayedError) return;
            const terminalFailure = this.isTerminalFailure(job);

            if (!terminalFailure) {
                await this.runListenerStep('publish retrying compression status', async () => {
                    await this.publishStatus(job.data.jobId, job.data.teamId, 'retrying', {
                        trajectoryId: job.data.trajectoryId,
                        trajectoryName: job.data.trajectoryName,
                        timestep: job.data.timestep,
                        error: error.message
                    });
                });
                return;
            }

            await this.runListenerStep('publish failed compression status', async () => {
                await this.publishStatus(job.data.jobId, job.data.teamId, JobStatus.Failed, {
                    trajectoryId: job.data.trajectoryId,
                    trajectoryName: job.data.trajectoryName,
                    timestep: job.data.timestep,
                    error: error.message
                });
            });

            await this.runListenerStep('increment failed compression count', async () => {
                await this.incrementFailed(job.data.trajectoryId);
            });

            await this.runListenerStep('decrement compression session', async () => {
                await this.decrementSession(job.data);
            });
        });

        this.worker.on('error', (error) => {
            logger.error(error, '@trajectory-compression-queue: worker error');
        });
    }

    public async enqueueBatch(
        jobs: Omit<CompressionJobData, 'jobId'>[]
    ): Promise<string[]> {
        this.start();
        if (jobs.length === 0) return [];

        const trajectoryId = jobs[0]?.trajectoryId;
        if (!trajectoryId) return [];

        await this.initializeSession(trajectoryId, jobs.length);

        const jobEntries = jobs.map((params) => {
            const jobId = uuid();
            return {
                jobId,
                name: `compress:${params.trajectoryId}:${params.timestep}`,
                data: { ...params, jobId } as CompressionJobData,
                opts: { jobId }
            };
        });

        await this.queue!.addBulk(jobEntries.map(({ name, data, opts }) => ({ name, data, opts })));

        await Promise.all(jobEntries.map(({ jobId, data }) => this.publishStatus(jobId, data.teamId, JobStatus.Queued, {
            trajectoryId: data.trajectoryId,
            trajectoryName: data.trajectoryName,
            timestep: data.timestep,
            message: 'Queued for zstd compression'
        })));

        return jobEntries.map((entry) => entry.jobId);
    }

    private sessionKey(trajectoryId: string): string {
        return `trajectory-compression-session:${trajectoryId}:remaining`;
    }

    private failedKey(trajectoryId: string): string {
        return `trajectory-compression-session:${trajectoryId}:failed`;
    }

    private successfulJobsKey(trajectoryId: string): string {
        return `trajectory-compression-session:${trajectoryId}:successful-jobs`;
    }

    private async initializeSession(trajectoryId: string, totalJobs: number): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.set(this.sessionKey(trajectoryId), totalJobs.toString(), 'EX', SESSION_TTL_SECONDS);
        pipeline.del(this.failedKey(trajectoryId));
        pipeline.del(this.successfulJobsKey(trajectoryId));
        await pipeline.exec();
    }

    private async incrementFailed(trajectoryId: string): Promise<void> {
        await this.redis.incr(this.failedKey(trajectoryId));
    }

    private async trackSuccessfulJob(job: CompressionJobData): Promise<void> {
        await this.redis.hset(
            this.successfulJobsKey(job.trajectoryId),
            String(job.timestep),
            JSON.stringify(job)
        );
    }

    private async getSuccessfulJobs(trajectoryId: string): Promise<CompressionJobData[]> {
        const jobs = await this.redis.hvals(this.successfulJobsKey(trajectoryId));
        return jobs.flatMap((value) => {
            try {
                return [JSON.parse(value) as CompressionJobData];
            } catch {
                return [];
            }
        }).sort((left, right) => left.timestep - right.timestep);
    }

    private async decrementSession(jobData: CompressionJobData): Promise<void> {
        const remaining = await this.redis.decr(this.sessionKey(jobData.trajectoryId));
        if (remaining > 0) return;

        const failedCount = Number.parseInt(await this.redis.get(this.failedKey(jobData.trajectoryId)) || '0', 10);
        const successfulJobs = await this.getSuccessfulJobs(jobData.trajectoryId);

        await this.redis.del(
            this.sessionKey(jobData.trajectoryId),
            this.failedKey(jobData.trajectoryId),
            this.successfulJobsKey(jobData.trajectoryId)
        );

        if (this.drainCallback) {
            await this.drainCallback(
                jobData.trajectoryId,
                jobData.teamId,
                jobData.teamClusterId,
                jobData.trajectoryName,
                failedCount,
                successfulJobs
            );
        }
    }

    private isTerminalFailure(job: Job<CompressionJobData>): boolean {
        return job.attemptsMade >= this.getAttemptLimit(job);
    }

    private getAttemptLimit(job: Job<CompressionJobData>): number {
        const attempts = job.opts.attempts;
        return typeof attempts === 'number' && Number.isFinite(attempts) && attempts > 0 ? attempts : 1;
    }

    private async runListenerStep(action: string, operation: () => Promise<void>): Promise<void> {
        try {
            await operation();
        } catch (error) {
            logger.error(error, `@trajectory-compression-queue: failed to ${action}`);
        }
    }

    private async publishStatus(
        jobId: string,
        teamId: string,
        status: JobStatusChangedValue,
        metadata: Record<string, unknown>
    ): Promise<void> {
        await this.eventBus.publish(new JobStatusChangedEvent({
            jobId,
            teamId,
            status,
            queueType: QUEUE_TYPE,
            metadata
        }));
    }
}
