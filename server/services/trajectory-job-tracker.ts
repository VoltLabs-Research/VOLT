import IORedis from 'ioredis';
import { createRedisClient } from '@/config/redis';
import logger from '@/logger';
import tempFileManager from '@/services/temp-file-manager';
import { Queues } from '@/constants/queues';

interface JobMetadata {
    trajectoryId: string;
    teamId: string;
    queueType: string;
    jobId: string;
    sessionId?: string;
}

class TrajectoryJobTracker {
    private redis: IORedis;
    private cleanupInProgress = new Set<string>();

    constructor() {
        this.redis = createRedisClient();
    }

    async incrementJobCount(metadata: JobMetadata): Promise<void> {
        const { trajectoryId, queueType, jobId } = metadata;
        const counterKey = `trajectory:${trajectoryId}:jobs:active`;
        const metaKey = `trajectory:${trajectoryId}:jobs:metadata`;

        const lua = `
            local counterKey = KEYS[1]
            local metaKey = KEYS[2]
            local queueType = ARGV[1]
            local timestamp = ARGV[2]

            -- Increment counter
            local count = redis.call('INCR', counterKey)
            redis.call('EXPIRE', counterKey, 604800)

            -- Update metadata
            redis.call('HINCRBY', metaKey, 'totalAdded', 1)
            redis.call('HSET', metaKey, 'lastJobAt', timestamp)
            redis.call('SADD', metaKey .. ':queues', queueType)
            redis.call('EXPIRE', metaKey, 604800)
            redis.call('EXPIRE', metaKey .. ':queues', 604800)

            -- Set first job timestamp if not exists
            if count == 1 then
                redis.call('HSETNX', metaKey, 'firstJobAt', timestamp)
            end

            return count
        `;

        const newCount = await this.redis.eval(
            lua,
            2,
            counterKey,
            metaKey,
            queueType,
            Date.now().toString()
        ) as number;

        logger.info(`[TrajectoryJobTracker] INCREMENT ${trajectoryId} | Queue: ${queueType} | JobId: ${jobId} | Counter: ${newCount}`);
    }

    async decrementJobCount(metadata: JobMetadata, status: 'completed' | 'failed'): Promise<boolean> {
        const { trajectoryId, teamId, queueType, jobId } = metadata;
        const counterKey = `trajectory:${trajectoryId}:jobs:active`;
        const metaKey = `trajectory:${trajectoryId}:jobs:metadata`;

        const lua = `
            local counterKey = KEYS[1]
            local metaKey = KEYS[2]
            local status = ARGV[1]
            local timestamp = ARGV[2]

            -- Get current count before decrement
            local currentCount = redis.call('GET', counterKey)
            if not currentCount then
                currentCount = 0
            end

            -- Decrement counter
            local remaining = redis.call('DECR', counterKey)

            -- Update metadata
            if status == 'completed' then
                redis.call('HINCRBY', metaKey, 'totalCompleted', 1)
            else
                redis.call('HINCRBY', metaKey, 'totalFailed', 1)
            end
            redis.call('HSET', metaKey, 'lastJobAt', timestamp)

            -- If remaining is 0 or negative, return 1 to trigger cleanup check
            if remaining <= 0 then
                return {1, currentCount, remaining}
            end

            return {0, currentCount, remaining}
        `;

        const result = await this.redis.eval(
            lua,
            2,
            counterKey,
            metaKey,
            status,
            Date.now().toString()
        ) as [number, number, number];

        const [shouldCleanup, beforeCount, afterCount] = result;

        logger.info(`[TrajectoryJobTracker] DECREMENT ${trajectoryId} | Queue: ${queueType} | JobId: ${jobId} | Status: ${status} | Before: ${beforeCount} | After: ${afterCount} | Cleanup: ${shouldCleanup === 1 ? 'YES' : 'NO'}`);

        if (shouldCleanup === 1) {
            logger.info(`[TrajectoryJobTracker] Counter reached 0 for ${trajectoryId}, initiating cleanup verification...`);
            return await this.verifyAndCleanup(trajectoryId, teamId);
        }

        return false;
    }

    private async verifyAndCleanup(trajectoryId: string, teamId: string): Promise<boolean> {
        logger.info(`[TrajectoryJobTracker] Attempting cleanup lock for ${trajectoryId}...`);

        if (this.cleanupInProgress.has(trajectoryId)) {
            logger.warn(`[TrajectoryJobTracker] Cleanup already in progress (in-memory flag) for ${trajectoryId}`);
            return false;
        }

        const lockKey = `trajectory:${trajectoryId}:cleanup:lock`;
        const lockVal = `${process.pid}:${Date.now()}`;

        const acquired = await this.redis.set(lockKey, lockVal, 'PX', 60000, 'NX');
        if (!acquired) {
            logger.warn(`[TrajectoryJobTracker] Cleanup already in progress (Redis lock) for ${trajectoryId}`);
            return false;
        }

        logger.info(`[TrajectoryJobTracker] Cleanup lock acquired for ${trajectoryId}`);
        this.cleanupInProgress.add(trajectoryId);

        try {
            logger.info(`[TrajectoryJobTracker] Checking for active jobs in queues for ${trajectoryId}...`);
            const hasActiveJobs = await this.hasActiveJobsInQueues(trajectoryId);

            if (hasActiveJobs) {
                logger.warn(`[TrajectoryJobTracker] Counter reached 0 but active jobs still exist for ${trajectoryId}. Resetting counter.`);
                await this.resetCounter(trajectoryId);
                return false;
            }

            logger.info(`[TrajectoryJobTracker] No active jobs found in queues for ${trajectoryId}`);

            logger.info(`[TrajectoryJobTracker] Checking for active analyses in DB for ${trajectoryId}...`);
            const { Analysis } = await import('@/models');
            const hasActiveAnalyses = await Analysis.exists({
                trajectory: trajectoryId,
                finishedAt: { $exists: false }
            });

            if (hasActiveAnalyses) {
                logger.info(`[TrajectoryJobTracker] Skipping cleanup for ${trajectoryId}: active analyses exist`);
                return false;
            }

            logger.info(`[TrajectoryJobTracker] No active analyses found for ${trajectoryId}`);

            logger.info(`[TrajectoryJobTracker] All jobs complete for ${trajectoryId}. Executing cleanup...`);
            await this.executeCleanup(trajectoryId);
            logger.info(`[TrajectoryJobTracker] Cleanup executed successfully for ${trajectoryId}`);

            logger.info(`[TrajectoryJobTracker] Deleting Redis metadata for ${trajectoryId}...`);
            await this.redis.del(
                `trajectory:${trajectoryId}:jobs:active`,
                `trajectory:${trajectoryId}:jobs:metadata`,
                `trajectory:${trajectoryId}:jobs:metadata:queues`
            );

            logger.info(`[TrajectoryJobTracker] Cleanup process complete for ${trajectoryId}`);
            return true;

        } finally {
            await this.redis.del(lockKey);
            this.cleanupInProgress.delete(trajectoryId);
            logger.info(`[TrajectoryJobTracker] Cleanup lock released for ${trajectoryId}`);
        }
    }

    private async hasActiveJobsInQueues(trajectoryId: string): Promise<boolean> {
        const queueNames = [
            Queues.TRAJECTORY_PROCESSING,
            Queues.ANALYSIS_PROCESSING,
            Queues.RASTERIZER,
            Queues.CLOUD_UPLOAD
        ];

        for (const queueName of queueNames) {
            const statusPattern = `${queueName}_queue:status:*`;

            let cursor = '0';
            do {
                const [newCursor, keys] = await this.redis.scan(
                    cursor,
                    'MATCH',
                    statusPattern,
                    'COUNT',
                    100
                );
                cursor = newCursor;

                if (keys.length > 0) {
                    const pipeline = this.redis.pipeline();
                    keys.forEach(key => pipeline.get(key));
                    const results = await pipeline.exec();

                    for (const [err, data] of results || []) {
                        if (err || !data) continue;

                        try {
                            const jobData = JSON.parse(data as string);

                            if (jobData.trajectoryId === trajectoryId) {
                                const status = jobData.status;
                                if (['queued', 'running', 'retrying'].includes(status)) {
                                    logger.debug(`[TrajectoryJobTracker] Found active job ${jobData.jobId} (${status}) in ${queueName}`);
                                    return true;
                                }
                            }
                        } catch (e) {
                            // Invalid JSON, skip
                        }
                    }
                }
            } while (cursor !== '0');
        }

        return false;
    }

    private async resetCounter(trajectoryId: string): Promise<void> {
        let activeCount = 0;

        const queueNames = [
            Queues.TRAJECTORY_PROCESSING,
            Queues.ANALYSIS_PROCESSING,
            Queues.RASTERIZER,
            Queues.CLOUD_UPLOAD
        ];

        for (const queueName of queueNames) {
            const statusPattern = `${queueName}_queue:status:*`;
            let cursor = '0';

            do {
                const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', statusPattern, 'COUNT', 100);
                cursor = newCursor;

                if (keys.length > 0) {
                    const pipeline = this.redis.pipeline();
                    keys.forEach(key => pipeline.get(key));
                    const results = await pipeline.exec();

                    for (const [err, data] of results || []) {
                        if (err || !data) continue;
                        try {
                            const jobData = JSON.parse(data as string);
                            if (jobData.trajectoryId === trajectoryId &&
                                ['queued', 'running', 'retrying'].includes(jobData.status)) {
                                activeCount++;
                            }
                        } catch (e) {}
                    }
                }
            } while (cursor !== '0');
        }

        const counterKey = `trajectory:${trajectoryId}:jobs:active`;
        await this.redis.set(counterKey, activeCount.toString(), 'EX', 604800);
        logger.info(`[TrajectoryJobTracker] Reset counter for ${trajectoryId} to ${activeCount}`);
    }

    private async executeCleanup(trajectoryId: string): Promise<void> {
        try {
            logger.info(`[TrajectoryJobTracker] Calling tempFileManager.cleanupTrajectoryDumps for ${trajectoryId}...`);
            await tempFileManager.cleanupTrajectoryDumps(trajectoryId);
            logger.info(`[TrajectoryJobTracker] Cleanup completed successfully for trajectory ${trajectoryId}`);
        } catch (error) {
            logger.error(`[TrajectoryJobTracker] Cleanup failed for ${trajectoryId}: ${error}`);
            throw error;
        }
    }

    async recoverCounters(): Promise<void> {
        logger.info('[TrajectoryJobTracker] Starting counter recovery...');

        const pattern = 'trajectory:*:jobs:active';
        let cursor = '0';
        const trajectoryIds = new Set<string>();

        do {
            const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = newCursor;

            for (const key of keys) {
                const match = key.match(/^trajectory:([^:]+):jobs:active$/);
                if (match) {
                    trajectoryIds.add(match[1]);
                }
            }
        } while (cursor !== '0');

        logger.info(`[TrajectoryJobTracker] Recovering ${trajectoryIds.size} trajectory counters...`);

        for (const trajectoryId of trajectoryIds) {
            await this.resetCounter(trajectoryId);
        }

        logger.info('[TrajectoryJobTracker] Counter recovery complete');
    }
}

export default new TrajectoryJobTracker();
