import { createBullMQRedisConnectionOptions, getRedisConfig } from '@core/config/redis';
import { getTrajectoryBackgroundProcessorConcurrency } from '@core/config/trajectory';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import CloudUploadProcessor from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadProcessor';
import { IEventBus } from '@shared/application/events/IEventBus';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import {
    createBullScopedQueue,
    type BullScopedQueueController
} from '@shared/infrastructure/workers/createBullScopedQueue';
import TeamClusterQueueScopeLimitsService from './TeamClusterQueueScopeLimitsService';

import IORedis from 'ioredis';
import { inject } from 'tsyringe';
import { v4 as uuid } from 'uuid';

const QUEUE_NAME = 'cloud_upload';
const QUEUE_TYPE = 'cloud_upload';
const SESSION_TTL_SECONDS = 86400;

export interface CloudUploadJobData {
    jobId: string;
    trajectoryId: string;
    teamId: string;
    teamClusterId: string;
    trajectoryName: string;
    timestep: number;
    frameFilePath: string;
    objectKey: string;
    contentType: string;
    contentEncoding?: string;
};

/**
 * Callback invoked when all upload jobs in a trajectory session have settled
 * (completed or exhausted retries).
 */
export type UploadSessionDrainCallback = (
    trajectoryId: string,
    teamId: string,
    teamClusterId: string,
    trajectoryName: string,
    failedCount: number,
    successfulTimesteps: number[]
) => Promise<void>;

@Singleton()
export default class CloudUploadQueueService {
    private controller: BullScopedQueueController<CloudUploadJobData, CloudUploadJobData> | null = null;
    private drainCallback: UploadSessionDrainCallback | null = null;

    constructor(
        
        private readonly cloudUploadProcessor: CloudUploadProcessor,

        
        private readonly teamClusterQueueScopeLimitsService: TeamClusterQueueScopeLimitsService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ){}

    /**
     * Registers a callback that fires when all upload jobs for a trajectory have settled.
     * The TrajectoryBackgroundProcessor uses this to trigger GLB preprocessing.
     */
    public onSessionDrain(callback: UploadSessionDrainCallback): void {
        this.drainCallback = callback;
    }

    public setConcurrency(concurrency: number): void {
        this.controller?.setConcurrency(concurrency);
    }

    public getConcurrency(): number {
        return this.controller?.getConcurrency() ?? getTrajectoryBackgroundProcessorConcurrency();
    }

    /**
     * Lazily initializes the BullMQ queue and worker.
     * Called on first enqueue or can be called explicitly at startup.
     */
    public start(): void {
        if (this.controller) {
            this.controller.start();
            return;
        }

        this.controller = createBullScopedQueue<CloudUploadJobData, CloudUploadJobData>({
            name: QUEUE_NAME,
            logTag: '@cloud-upload-queue',
            redisConnectionFactory: () => createBullMQRedisConnectionOptions(getRedisConfig()),
            concurrency: getTrajectoryBackgroundProcessorConcurrency(),
            scopeLease: {
                redis: this.redis,
                resolveConstraints: async (job) => {
                    const trajectoryId = job.data.trajectoryId.trim();
                    if (!trajectoryId) {
                        throw new Error(`Missing trajectoryId for cloud upload job ${job.data.jobId}`);
                    }

                    const queueScopeLimits = await this.teamClusterQueueScopeLimitsService.getLimits(
                        job.data.teamClusterId,
                        'cloudUpload'
                    );
                    return [
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
                    ];
                }
            },
            processor: async (job) => {
                const { jobId, teamId, trajectoryName, timestep } = job.data;
                const trajectoryId = job.data.trajectoryId.trim();

                await this.publishStatus(jobId, teamId, JobStatus.Running, {
                    trajectoryId,
                    trajectoryName,
                    timestep
                });

                await this.cloudUploadProcessor.process({
                    trajectoryId,
                    teamId,
                    teamClusterId: job.data.teamClusterId,
                    trajectoryName,
                    timestep,
                    frameFilePath: job.data.frameFilePath,
                    objectKey: job.data.objectKey,
                    contentType: job.data.contentType,
                    contentEncoding: job.data.contentEncoding
                });

                return job.data;
            },
            onJobCompleted: async (job) => {
                const { jobId, teamId, trajectoryId, trajectoryName, timestep } = job.data;

                await this.runListenerStep('publish completed upload status', async () => {
                    await this.publishStatus(jobId, teamId, JobStatus.Completed, {
                        trajectoryId,
                        trajectoryName,
                        timestep
                    });
                });

                await this.runListenerStep('track successful upload timestep', async () => {
                    await this.trackSuccessfulTimestep(trajectoryId, timestep);
                });
                await this.runListenerStep('decrement upload session', async () => {
                    await this.decrementSession(job.data);
                });
            },
            onJobFailed: async (job, error) => {
                const { jobId, teamId, trajectoryId, trajectoryName, timestep } = job.data;

                logger.error(
                    {
                        jobId,
                        trajectoryId,
                        timestep,
                        error: error.message
                    },
                    `@cloud-upload-queue: job failed`
                );

                await this.runListenerStep('publish failed upload status', async () => {
                    await this.publishStatus(jobId, teamId, JobStatus.Failed, {
                        trajectoryId,
                        trajectoryName,
                        timestep,
                        error: error.message
                    });
                });

                await this.runListenerStep('increment failed upload count', async () => {
                    await this.incrementFailed(job.data.trajectoryId);
                });
                await this.runListenerStep('decrement upload session', async () => {
                    await this.decrementSession(job.data);
                });
            }
        });

        this.controller.start();
    }

    /**
     * Enqueues multiple upload jobs in bulk, initializes a session counter,
     * and publishes "queued" status for each job.
     * Returns an array of job IDs.
     */
    public async enqueueBatch(
        jobs: Array<{
            trajectoryId: string;
            teamId: string;
            teamClusterId: string;
            trajectoryName: string;
            timestep: number;
            frameFilePath: string;
            objectKey: string;
            contentType: string;
            contentEncoding?: string;
        }>
    ): Promise<string[]> {
        this.start();

        if (jobs.length === 0) return [];

        // All jobs in a batch share the same trajectoryId
        const { trajectoryId } = jobs[0];

        // Initialize session counter in Redis
        await this.initializeSession(trajectoryId, jobs.length);

        const jobEntries = jobs.map((params) => {
            const jobId = uuid();
            return {
                jobId,
                name: `upload:${params.trajectoryId}:${params.timestep}`,
                data: { jobId, ...params } as CloudUploadJobData,
                opts: { jobId }
            };
        });

        const handle = this.controller!.requireHandle();
        await handle.addBulk(
            jobEntries.map(({ name, data, opts }) => ({ name, data, opts }))
        );

        // Publish queued status for all jobs
        await Promise.all(
            jobEntries.map(({ jobId, data }) =>
                this.publishStatus(jobId, data.teamId, JobStatus.Queued, {
                    trajectoryId: data.trajectoryId,
                    trajectoryName: data.trajectoryName,
                    timestep: data.timestep
                })
            )
        );

        return jobEntries.map((e) => e.jobId);
    }

    /**
     * Gracefully shuts down the worker and closes the queue connection.
     */
    public async stop(): Promise<void> {
        if (this.controller) {
            await this.controller.close();
        }
    }

    // ── Session tracking ──────────────────────────────────────────────

    private sessionKey(trajectoryId: string): string {
        return `cloud-upload-session:${trajectoryId}:remaining`;
    }

    private failedKey(trajectoryId: string): string {
        return `cloud-upload-session:${trajectoryId}:failed`;
    }

    private successfulTimestepsKey(trajectoryId: string): string {
        return `cloud-upload-session:${trajectoryId}:successful-timesteps`;
    }

    private async initializeSession(trajectoryId: string, totalJobs: number): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.set(this.sessionKey(trajectoryId), totalJobs.toString(), 'EX', SESSION_TTL_SECONDS);
        pipeline.del(this.failedKey(trajectoryId));
        pipeline.del(this.successfulTimestepsKey(trajectoryId));
        await pipeline.exec();
    }

    private async incrementFailed(trajectoryId: string): Promise<void> {
        await this.redis.incr(this.failedKey(trajectoryId));
    }

    private async trackSuccessfulTimestep(trajectoryId: string, timestep: number): Promise<void> {
        await this.redis.sadd(this.successfulTimestepsKey(trajectoryId), timestep.toString());
    }

    private async getSuccessfulTimesteps(trajectoryId: string): Promise<number[]> {
        const members = await this.redis.smembers(this.successfulTimestepsKey(trajectoryId));
        return members.map((m) => parseInt(m, 10)).filter((n) => Number.isFinite(n));
    }

    private async decrementSession(jobData: CloudUploadJobData): Promise<void> {
        const remaining = await this.redis.decr(this.sessionKey(jobData.trajectoryId));

        if (remaining > 0) return;

        // Session drained — all upload jobs have settled
        const failedStr = await this.redis.get(this.failedKey(jobData.trajectoryId));
        const failedCount = failedStr ? parseInt(failedStr, 10) : 0;
        const successfulTimesteps = await this.getSuccessfulTimesteps(jobData.trajectoryId);

        // Cleanup session keys
        await this.redis.del(
            this.sessionKey(jobData.trajectoryId),
            this.failedKey(jobData.trajectoryId),
            this.successfulTimestepsKey(jobData.trajectoryId)
        );

        // Fire callback
        if (this.drainCallback) {
            try {
                await this.drainCallback(
                    jobData.trajectoryId,
                    jobData.teamId,
                    jobData.teamClusterId,
                    jobData.trajectoryName,
                    failedCount,
                    successfulTimesteps
                );
            } catch (error) {
                logger.error(
                    error,
                    `@cloud-upload-queue: drain callback failed for trajectory ${jobData.trajectoryId}`
                );
            }
        }
    }

    private async runListenerStep(action: string, operation: () => Promise<void>): Promise<void> {
        try {
            await operation();
        } catch (error) {
            logger.error(error, `@cloud-upload-queue: failed to ${action}`);
        }
    }

    // ── Event publishing ──────────────────────────────────────────────

    private async publishStatus(
        jobId: string,
        teamId: string,
        status: JobStatus,
        details: Record<string, unknown>
    ): Promise<void> {
        await this.eventBus.publish(
            new JobStatusChangedEvent({
                jobId,
                teamId,
                status,
                queueType: QUEUE_TYPE,
                ...details
            })
        );
    }
};
