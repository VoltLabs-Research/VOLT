import IORedis from 'ioredis';
import { BaseJob } from '@/types/queues/base-processing-queue';
import { publishJobUpdate } from '@/events/job-updates';
import { QUEUE_DEFAULTS } from '@/config/queue-defaults';
import jobService from '@/services/jobs';
import logger from '@/logger';

export interface JobHandlerConfig {
    queueName: string;
    statusKeyPrefix: string;
    logPrefix: string;
}

export interface JobInfo<T extends BaseJob> {
    job: T;
    rawData: string;
    startTime: number;
}

/**
 * Handles job status updates, message processing, and failure handling.
 */
export class JobHandler<T extends BaseJob> {
    constructor(
        private readonly redis: IORedis,
        private readonly config: JobHandlerConfig
    ){}

    private logInfo(message: string): void {
        logger.info(`${this.config.logPrefix} ${message}`);
    }

    private logError(message: string): void {
        logger.error(`${this.config.logPrefix} ${message}`);
    }

    /**
     * Set job status in Redis and publish update
     */
    async setJobStatus(jobId: string, status: string, data: any): Promise<void> {
        const statusData = {
            jobId,
            status,
            timestamp: new Date().toISOString(),
            queueType: this.config.queueName,
            ...data
        };

        const statusKey = `${this.config.statusKeyPrefix}${jobId}`;
        const teamId = data.teamId;

        await this.redis.set(statusKey, JSON.stringify(statusData), 'EX', QUEUE_DEFAULTS.TTL_SECONDS);

        if (teamId) {
            const teamJobsKey = `team:${teamId}:jobs`;
            await this.redis.sadd(teamJobsKey, jobId);
        }

        // Update trajectory status using centralized service
        // Race condition fix: Don't update for completed/failed here.
        // The QueueCore will handle it after removing the job from Redis.
        if (data.trajectoryId && teamId && !['completed', 'failed'].includes(status)) {
            try {
                const trajectoryStatusService = (await import('@/services/trajectory/status-service')).default;
                await trajectoryStatusService.updateFromJobStatus({
                    trajectoryId: data.trajectoryId,
                    teamId,
                    sessionId: data.sessionId,
                    jobStatus: status,
                    queueType: data.queueType || this.config.queueName
                } as any);
            } catch (error) {
                this.logError(`Failed to update trajectory status: ${error}`);
            }
        }

        await publishJobUpdate(teamId, statusData);
    }

    /**
     * Get job status from Redis
     */
    async getJobStatus(jobId: string): Promise<any | null> {
        const statusKey = `${this.config.statusKeyPrefix}${jobId}`;
        try {
            const statusData = await this.redis.get(statusKey);
            if (!statusData) {
                return null;
            }

            return JSON.parse(statusData);
        } catch (error) {
            this.logError(`Failed to get status for job ${jobId}: ${error}`);
            return null;
        }
    }

    /**
     * Handle job failure with retry logic
     */
    async handleJobFailure(
        job: T,
        error: string,
        processingTime: number,
        rawData: string,
        queueKey: string
    ): Promise<boolean> {
        const maxAttempts = job.maxRetries || 1;
        const retryCountKey = `job:retries:${job.jobId}`;

        // Increment the retry counter for this job ID in Redis.
        const currentAttempt = await this.redis.incr(retryCountKey);
        await this.redis.expire(retryCountKey, QUEUE_DEFAULTS.TTL_SECONDS);

        // If maximum attempts reached, mark as permanently failed
        this.logError(`Job ${job.jobId} failed after ${maxAttempts} attempts. Removing from queue permanently.`);

        const statusKey = `${this.config.statusKeyPrefix}${job.jobId}`;
        await this.redis.del(statusKey);
        await this.redis.del(retryCountKey);

        return true;
    }

    /**
     * Track job completion at trajectory level
     */
    async trackJobCompletion(job: T, status: 'completed' | 'failed'): Promise<void> {
        try {
            this.logInfo(`Attempting to decrement trajectory job counter for job ${job.jobId}...`);
            await jobService.decrement({
                entityId: job.trajectoryId,
                teamId: job.teamId,
                queueType: this.config.queueName,
                jobId: job.jobId,
            }, status);
            this.logInfo(`Successfully decremented counter for job ${job.jobId}`);
        } catch (trackerError) {
            this.logError(`Failed to decrement trajectory job counter: ${trackerError}`);
            if (trackerError instanceof Error) {
                this.logError(`Stack: ${trackerError.stack || 'N/A'}`);
            }
        }
    }

    /**
     * Track job increment at trajectory level
     */
    async trackJobIncrement(job: T, sessionId: string): Promise<void> {
        try {
            await jobService.increment({
                entityId: job.trajectoryId,
                teamId: job.teamId,
                queueType: this.config.queueName,
                jobId: job.jobId,
            });
        } catch (trackerError) {
            this.logError(`Failed to increment trajectory job counter: ${trackerError}`);
        }
    }
}
