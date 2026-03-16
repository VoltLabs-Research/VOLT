import { getRedisConfig, createBullMQRedisConnectionOptions } from '@core/config/redis';
import { getTrajectoryBackgroundProcessorConcurrency } from '@core/config/trajectory';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import CloudUploadProcessor from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadProcessor';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';
import { Queue, Worker } from 'bullmq';
import { v4 as uuid } from 'uuid';
import IORedis from 'ioredis';

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
    failedCount: number
) => Promise<void>;

@injectable()
export default class CloudUploadQueueService {
    private queue: Queue | null = null;
    private worker: Worker | null = null;
    private drainCallback: UploadSessionDrainCallback | null = null;

    constructor(
        @inject(TRAJECTORY_TOKENS.CloudUploadProcessor)
        private readonly cloudUploadProcessor: CloudUploadProcessor,

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

    /**
     * Lazily initializes the BullMQ queue and worker.
     * Called on first enqueue or can be called explicitly at startup.
     */
    public start(): void {
        if (this.queue) return;

        const connection = createBullMQRedisConnectionOptions(getRedisConfig());
        const concurrency = getTrajectoryBackgroundProcessorConcurrency();

        this.queue = new Queue(QUEUE_NAME, {
            connection,
            defaultJobOptions: {
                removeOnComplete: { count: 500 },
                removeOnFail: { count: 200 },
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                }
            }
        });

        this.worker = new Worker<CloudUploadJobData>(
            QUEUE_NAME,
            async (job) => {
                const { jobId, teamId, trajectoryId, trajectoryName, timestep } = job.data;

                // Emit running status
                await this.publishStatus(jobId, teamId, JobStatus.Running, {
                    trajectoryId,
                    trajectoryName,
                    timestep
                });

                // Delegate to the existing CloudUploadProcessor
                await this.cloudUploadProcessor.process({
                    trajectoryId,
                    teamId,
                    teamClusterId: job.data.teamClusterId,
                    trajectoryName,
                    timestep,
                    frameFilePath: job.data.frameFilePath
                });

                // Emit completed status
                await this.publishStatus(jobId, teamId, JobStatus.Completed, {
                    trajectoryId,
                    trajectoryName,
                    timestep
                });

                // Decrement session counter and fire drain callback if all settled
                await this.decrementSession(job.data);
            },
            {
                connection,
                concurrency,
                removeOnComplete: { count: 500 },
                removeOnFail: { count: 200 }
            }
        );

        this.worker.on('failed', async (job, error) => {
            if (!job) return;

            const { jobId, teamId, trajectoryId, trajectoryName, timestep } = job.data;

            logger.error(
                { jobId, trajectoryId, timestep, error: error.message },
                `@cloud-upload-queue: job failed`
            );

            await this.publishStatus(jobId, teamId, JobStatus.Failed, {
                trajectoryId,
                trajectoryName,
                timestep,
                error: error.message
            });

            // Track failure and decrement session counter
            await this.incrementFailed(job.data.trajectoryId);
            await this.decrementSession(job.data);
        });

        this.worker.on('error', (error) => {
            logger.error(error, '@cloud-upload-queue: worker error');
        });

        logger.info(
            { concurrency },
            `@cloud-upload-queue: started queue="${QUEUE_NAME}" with concurrency=${concurrency}`
        );
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

        await this.queue!.addBulk(
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
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
        }
        if (this.queue) {
            await this.queue.close();
            this.queue = null;
        }
        logger.info('@cloud-upload-queue: stopped');
    }

    // ── Session tracking ──────────────────────────────────────────────

    private sessionKey(trajectoryId: string): string {
        return `cloud-upload-session:${trajectoryId}:remaining`;
    }

    private failedKey(trajectoryId: string): string {
        return `cloud-upload-session:${trajectoryId}:failed`;
    }

    private async initializeSession(trajectoryId: string, totalJobs: number): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.set(this.sessionKey(trajectoryId), totalJobs.toString(), 'EX', SESSION_TTL_SECONDS);
        pipeline.del(this.failedKey(trajectoryId));
        await pipeline.exec();

        logger.info(
            { trajectoryId, totalJobs },
            '@cloud-upload-queue: initialized upload session'
        );
    }

    private async incrementFailed(trajectoryId: string): Promise<void> {
        await this.redis.incr(this.failedKey(trajectoryId));
    }

    private async decrementSession(jobData: CloudUploadJobData): Promise<void> {
        const remaining = await this.redis.decr(this.sessionKey(jobData.trajectoryId));

        if (remaining > 0) return;

        // Session drained — all upload jobs have settled
        const failedStr = await this.redis.get(this.failedKey(jobData.trajectoryId));
        const failedCount = failedStr ? parseInt(failedStr, 10) : 0;

        logger.info(
            {
                trajectoryId: jobData.trajectoryId,
                failedCount
            },
            '@cloud-upload-queue: upload session drained'
        );

        // Cleanup session keys
        await this.redis.del(
            this.sessionKey(jobData.trajectoryId),
            this.failedKey(jobData.trajectoryId)
        );

        // Fire callback
        if (this.drainCallback) {
            try {
                await this.drainCallback(
                    jobData.trajectoryId,
                    jobData.teamId,
                    jobData.teamClusterId,
                    jobData.trajectoryName,
                    failedCount
                );
            } catch (error) {
                logger.error(
                    error,
                    `@cloud-upload-queue: drain callback failed for trajectory ${jobData.trajectoryId}`
                );
            }
        }
    }

    // ── Event publishing ──────────────────────────────────────────────

    private async publishStatus(
        jobId: string,
        teamId: string,
        status: JobStatus,
        metadata: Record<string, unknown>
    ): Promise<void> {
        await this.eventBus.publish(
            new JobStatusChangedEvent({
                jobId,
                teamId,
                status,
                queueType: QUEUE_TYPE,
                metadata
            })
        );
    }
};
