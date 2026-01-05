import IORedis from 'ioredis';
import { createRedisClient } from '@/config/redis';
import logger from '@/logger';
import { Queues } from '@/constants/queues';

interface JobData {
    jobId: string;
    trajectoryId: string;
    teamId: string;
    status: string;
    queueType: string;
    analysisId?: string;
    [key: string]: any;
}

interface ScanJobsResult {
    jobs: JobData[];
    totalScanned: number;
}

class TrajectoryJobManager {
    private redis: IORedis;

    constructor() {
        this.redis = createRedisClient();
    }

    /**
     * Get all queue names to scan
     */
    private getQueueNames(): string[] {
        return [
            Queues.TRAJECTORY_PROCESSING,
            Queues.ANALYSIS_PROCESSING,
            Queues.RASTERIZER,
            Queues.CLOUD_UPLOAD
        ];
    }

    /**
     * Scan Redis for all jobs belonging to a specific trajectory
     */
    async scanJobsForTrajectory(
        trajectoryId: string,
        statusFilter?: string[]
    ): Promise<ScanJobsResult> {
        const jobs: JobData[] = [];
        let totalScanned = 0;
        const queueNames = this.getQueueNames();

        for (const queueName of queueNames) {
            const pattern = `${queueName}_queue:status:*`;
            let cursor = '0';

            do {
                const [newCursor, keys] = await this.redis.scan(
                    cursor,
                    'MATCH',
                    pattern,
                    'COUNT',
                    100
                );
                cursor = newCursor;
                totalScanned += keys.length;

                if (keys.length > 0) {
                    const pipeline = this.redis.pipeline();
                    keys.forEach(key => pipeline.get(key));
                    const results = await pipeline.exec();

                    for (let i = 0; i < results!.length; i++) {
                        const [err, data] = results![i];
                        if (err || !data) continue;

                        try {
                            const jobData = JSON.parse(data as string);

                            // Filter by trajectoryId
                            if (jobData.trajectoryId === trajectoryId) {
                                // Apply status filter if provided
                                if (!statusFilter || statusFilter.includes(jobData.status)) {
                                    jobs.push({
                                        ...jobData,
                                        queueType: queueName,
                                        redisKey: keys[i]
                                    });
                                }
                            }
                        } catch (e) {
                            logger.warn(`[TrajectoryJobManager] Failed to parse job data: ${e}`);
                        }
                    }
                }
            } while (cursor !== '0');
        }

        logger.info(`[TrajectoryJobManager] Scanned ${totalScanned} keys, found ${jobs.length} jobs for trajectory ${trajectoryId}`);
        return { jobs, totalScanned };
    }

    /**
     * Delete a job from Redis (status key, retry counter, queue lists)
     */
    async deleteJob(job: JobData): Promise<void> {
        const { jobId, queueType, teamId } = job;
        const queueKey = `${queueType}_queue`;
        const processingKey = `${queueType}_queue:processing`;
        const statusKey = `${queueType}_queue:status:${jobId}`;
        const retryCountKey = `job:retries:${jobId}`;
        const teamJobsKey = `team:${teamId}:jobs`;

        // Delete status key
        await this.redis.del(statusKey);

        // Delete retry counter
        await this.redis.del(retryCountKey);

        // Remove from team jobs set
        await this.redis.srem(teamJobsKey, jobId);

        // Try to remove from queue (if still pending)
        const rawData = JSON.stringify(job);
        await this.redis.lrem(queueKey, 0, rawData);

        // Try to remove from processing list
        await this.redis.lrem(processingKey, 0, rawData);

        logger.debug(`[TrajectoryJobManager] Deleted job ${jobId} from Redis`);
    }

    /**
     * Delete multiple jobs in batch
     */
    async deleteJobs(jobs: JobData[]): Promise<number> {
        let deletedCount = 0;

        for (const job of jobs) {
            try {
                await this.deleteJob(job);
                deletedCount++;
            } catch (error) {
                logger.error(`[TrajectoryJobManager] Failed to delete job ${job.jobId}: ${error}`);
            }
        }

        logger.info(`[TrajectoryJobManager] Deleted ${deletedCount}/${jobs.length} jobs`);
        return deletedCount;
    }

    /**
     * Clear all trajectory-level metadata from Redis
     */
    async clearTrajectoryMetadata(trajectoryId: string): Promise<void> {
        const keys = [
            `trajectory:${trajectoryId}:jobs:active`,
            `trajectory:${trajectoryId}:jobs:metadata`,
            `trajectory:${trajectoryId}:jobs:metadata:queues`,
            `trajectory:${trajectoryId}:cleanup:lock`
        ];

        await this.redis.del(...keys);
        logger.info(`[TrajectoryJobManager] Cleared metadata for trajectory ${trajectoryId}`);
    }

    /**
     * Acquire a cleanup lock for a trajectory
     */
    async acquireCleanupLock(trajectoryId: string, ttlMs: number = 60000): Promise<boolean> {
        const lockKey = `trajectory:${trajectoryId}:cleanup:lock`;
        const lockVal = `${process.pid}:${Date.now()}`;

        const acquired = await this.redis.set(lockKey, lockVal, 'PX', ttlMs, 'NX');
        return acquired === 'OK';
    }

    /**
     * Release a cleanup lock for a trajectory
     */
    async releaseCleanupLock(trajectoryId: string): Promise<void> {
        const lockKey = `trajectory:${trajectoryId}:cleanup:lock`;
        await this.redis.del(lockKey);
    }

    /**
     * Extract unique analysis IDs from jobs
     */
    extractAnalysisIds(jobs: JobData[]): string[] {
        const analysisIds = new Set<string>();

        for (const job of jobs) {
            // Analysis jobs have format: analysisId-frameIndex
            if (job.queueType === Queues.ANALYSIS_PROCESSING && job.jobId) {
                const parts = job.jobId.split('-');
                if (parts.length >= 2) {
                    // Remove the last part (frame index) to get analysisId
                    const analysisId = parts.slice(0, -1).join('-');
                    analysisIds.add(analysisId);
                }
            }

            // Also check if analysisId is directly present
            if (job.analysisId) {
                analysisIds.add(job.analysisId);
            }
        }

        return Array.from(analysisIds);
    }

    /**
     * Publish job update to WebSocket clients
     */
    async publishJobClearEvent(teamId: string, trajectoryId: string, eventType: string): Promise<void> {
        const channel = `job_updates`;
        const payload = JSON.stringify({
            type: eventType,
            trajectoryId,
            teamId,
            timestamp: new Date().toISOString()
        });

        await this.redis.publish(channel, payload);
        logger.info(`[TrajectoryJobManager] Published ${eventType} event for trajectory ${trajectoryId}`);
    }
}

export default new TrajectoryJobManager();
