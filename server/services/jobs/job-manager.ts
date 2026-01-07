/**
 * JobManager - Unified job management for any entity type
 * 
 * @example
 * const manager = new JobManager({
 *     entityType: 'trajectory',
 *     entityField: 'trajectoryId',
 *     queues: [Queues.ANALYSIS, Queues.RASTERIZER],
 *     onCleanup: async (entityId) => { ... }
 * });
 */

import IORedis from 'ioredis';
import { createRedisClient } from '@/config/redis';
import { eventBus } from '@/events/event-bus';
import logger from '@/logger';

export interface JobManagerConfig {
    entityType: string;
    entityField: string;
    queues: string[];
    keyPrefix?: string;
    ttlSeconds?: number;
    onCleanup?: (entityId: string, teamId?: string) => Promise<void>;
}

export interface JobContext {
    entityId: string;
    teamId?: string;
    queueType: string;
    jobId: string;
    sessionId?: string;
}

export class JobManager {
    private redis: IORedis;
    private config: Required<Omit<JobManagerConfig, 'onCleanup'>> & Pick<JobManagerConfig, 'onCleanup'>;
    private inProgress = new Set<string>();
    private eventName: string;

    constructor(config: JobManagerConfig) {
        this.redis = createRedisClient();
        this.config = {
            entityType: config.entityType,
            entityField: config.entityField,
            queues: config.queues,
            keyPrefix: config.keyPrefix || config.entityType,
            ttlSeconds: config.ttlSeconds || 604800,
            onCleanup: config.onCleanup,
        };
        this.eventName = `${config.entityType}:jobs:zero`;
        this.subscribeToEvents();
    }

    private subscribeToEvents(): void {
        eventBus.on(this.eventName, async (ctx: { entityId: string; teamId?: string }) => {
            await this.verifyAndCleanup(ctx.entityId, ctx.teamId);
        });
    }

    private key(entityId: string, suffix: string): string {
        return `${this.config.keyPrefix}:${entityId}:${suffix}`;
    }

    // ============ Counter Operations ============

    async increment(ctx: JobContext): Promise<number> {
        const counterKey = this.key(ctx.entityId, 'jobs:active');
        const metaKey = this.key(ctx.entityId, 'jobs:metadata');
        const ttl = this.config.ttlSeconds;

        const lua = `
            local count = redis.call('INCR', KEYS[1])
            redis.call('EXPIRE', KEYS[1], ARGV[3])
            redis.call('HINCRBY', KEYS[2], 'totalAdded', 1)
            redis.call('HSET', KEYS[2], 'lastJobAt', ARGV[2])
            redis.call('SADD', KEYS[2] .. ':queues', ARGV[1])
            redis.call('EXPIRE', KEYS[2], ARGV[3])
            if count == 1 then
                redis.call('HSETNX', KEYS[2], 'firstJobAt', ARGV[2])
            end
            return count
        `;

        const count = await this.redis.eval(
            lua, 2, counterKey, metaKey,
            ctx.queueType, Date.now().toString(), ttl.toString()
        ) as number;

        logger.info(`[JobManager:${this.config.entityType}] INCREMENT ${ctx.entityId} | ${ctx.queueType} | Count: ${count}`);
        return count;
    }

    async decrement(ctx: JobContext, status: 'completed' | 'failed'): Promise<{ remaining: number; isZero: boolean }> {
        const counterKey = this.key(ctx.entityId, 'jobs:active');
        const metaKey = this.key(ctx.entityId, 'jobs:metadata');

        const lua = `
            local remaining = redis.call('DECR', KEYS[1])
            if ARGV[1] == 'completed' then
                redis.call('HINCRBY', KEYS[2], 'totalCompleted', 1)
            else
                redis.call('HINCRBY', KEYS[2], 'totalFailed', 1)
            end
            redis.call('HSET', KEYS[2], 'lastJobAt', ARGV[2])
            return remaining
        `;

        const remaining = await this.redis.eval(lua, 2, counterKey, metaKey, status, Date.now().toString()) as number;
        const isZero = remaining <= 0;

        logger.info(`[JobManager:${this.config.entityType}] DECREMENT ${ctx.entityId} | ${status} | Remaining: ${remaining}`);

        if (isZero) {
            await eventBus.emit(this.eventName, { entityId: ctx.entityId, teamId: ctx.teamId });
        }

        return { remaining, isZero };
    }

    // ============ Scanner Operations ============

    async scanJobs(entityId: string, statusFilter?: string[]): Promise<any[]> {
        const jobs: any[] = [];

        for (const queueName of this.config.queues) {
            const pattern = `${queueName}_queue:status:*`;
            let cursor = '0';

            do {
                const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = newCursor;

                if (keys.length > 0) {
                    const pipeline = this.redis.pipeline();
                    keys.forEach(k => pipeline.get(k));
                    const results = await pipeline.exec();

                    for (let i = 0; i < results!.length; i++) {
                        const [err, data] = results![i];
                        if (err || !data) continue;

                        try {
                            const job = JSON.parse(data as string);
                            if (job[this.config.entityField] !== entityId) continue;
                            if (statusFilter && !statusFilter.includes(job.status)) continue;
                            jobs.push({ ...job, queueType: queueName, redisKey: keys[i] });
                        } catch { /* skip invalid JSON */ }
                    }
                }
            } while (cursor !== '0');
        }

        return jobs;
    }

    async hasActiveJobs(entityId: string): Promise<boolean> {
        const jobs = await this.scanJobs(entityId, ['queued', 'running', 'retrying']);
        return jobs.length > 0;
    }

    async deleteJob(job: any): Promise<void> {
        const { jobId, queueType, teamId } = job;
        if (queueType && jobId) {
            await this.redis.del(`${queueType}_queue:status:${jobId}`);
        }
        await this.redis.del(`job:retries:${jobId}`);
        if (teamId) {
            await this.redis.srem(`team:${teamId}:jobs`, jobId);
        }
    }

    async deleteJobs(jobs: any[]): Promise<number> {
        let count = 0;
        for (const job of jobs) {
            try {
                await this.deleteJob(job);
                count++;
            } catch (e) {
                logger.error(`[JobManager] Failed to delete job ${job.jobId}: ${e}`);
            }
        }
        return count;
    }

    // ============ Cleanup & Locking ============

    async verifyAndCleanup(entityId: string, teamId?: string): Promise<boolean> {
        if (this.inProgress.has(entityId)) return false;

        const lockKey = this.key(entityId, 'cleanup:lock');
        const acquired = await this.redis.set(lockKey, `${process.pid}:${Date.now()}`, 'PX', 60000, 'NX');
        if (!acquired) return false;

        this.inProgress.add(entityId);

        try {
            if (await this.hasActiveJobs(entityId)) {
                logger.warn(`[JobManager:${this.config.entityType}] Active jobs exist for ${entityId}`);
                return false;
            }

            if (this.config.onCleanup) {
                await this.config.onCleanup(entityId, teamId);
            }

            await this.clearMetadata(entityId);
            logger.info(`[JobManager:${this.config.entityType}] Cleanup complete for ${entityId}`);
            return true;

        } finally {
            await this.redis.del(lockKey);
            this.inProgress.delete(entityId);
        }
    }

    async clearMetadata(entityId: string): Promise<void> {
        await this.redis.del(
            this.key(entityId, 'jobs:active'),
            this.key(entityId, 'jobs:metadata'),
            this.key(entityId, 'jobs:metadata:queues'),
            this.key(entityId, 'cleanup:lock')
        );
    }

    async acquireLock(entityId: string, ttlMs = 60000): Promise<boolean> {
        return (await this.redis.set(this.key(entityId, 'cleanup:lock'), `${process.pid}:${Date.now()}`, 'PX', ttlMs, 'NX')) === 'OK';
    }

    async releaseLock(entityId: string): Promise<void> {
        await this.redis.del(this.key(entityId, 'cleanup:lock'));
    }

    async publishEvent(entityId: string, teamId: string, eventType: string): Promise<void> {
        await this.redis.publish('job_updates', JSON.stringify({
            teamId,
            payload: { type: eventType, [this.config.entityField]: entityId, teamId, timestamp: new Date().toISOString() }
        }));
    }

    // ============ High-Level Operations ============

    /**
     * Clear all job history for an entity
     */
    async clearHistory(entityId: string, teamId: string, opts?: {
        deleteRelated?: (jobs: any[]) => Promise<number>
    }): Promise<{ deletedJobs: number; deletedRelated: number }> {
        const lockAcquired = await this.acquireLock(entityId, 120000);
        if (!lockAcquired) throw new Error('LOCK_CONFLICT');

        try {
            const jobs = await this.scanJobs(entityId);
            const deletedJobs = await this.deleteJobs(jobs);
            const deletedRelated = opts?.deleteRelated ? await opts.deleteRelated(jobs) : 0;

            await this.clearMetadata(entityId);
            await this.publishEvent(entityId, teamId, `${this.config.entityType}_history_cleared`);

            logger.info(`[JobManager:${this.config.entityType}] Cleared ${entityId}: ${deletedJobs} jobs, ${deletedRelated} related`);
            return { deletedJobs, deletedRelated };
        } finally {
            await this.releaseLock(entityId);
        }
    }

    /**
     * Remove only active (running/queued) jobs
     */
    async removeActiveJobs(entityId: string, teamId: string, opts?: {
        deleteRelated?: (jobs: any[]) => Promise<number>
    }): Promise<{ deletedJobs: number; deletedRelated: number }> {
        const lockAcquired = await this.acquireLock(entityId, 120000);
        if (!lockAcquired) throw new Error('LOCK_CONFLICT');

        try {
            const jobs = await this.scanJobs(entityId, ['running', 'queued', 'retrying']);
            if (jobs.length === 0) {
                return { deletedJobs: 0, deletedRelated: 0 };
            }

            const deletedJobs = await this.deleteJobs(jobs);
            const deletedRelated = opts?.deleteRelated ? await opts.deleteRelated(jobs) : 0;

            const remaining = await this.scanJobs(entityId);
            if (remaining.length === 0) {
                await this.clearMetadata(entityId);
            }

            await this.publishEvent(entityId, teamId, `${this.config.entityType}_active_jobs_removed`);

            logger.info(`[JobManager:${this.config.entityType}] Removed active jobs for ${entityId}: ${deletedJobs} jobs`);
            return { deletedJobs, deletedRelated };
        } finally {
            await this.releaseLock(entityId);
        }
    }

    /**
     * Get failed jobs for retry
     */
    async getFailedJobs(entityId: string): Promise<any[]> {
        return this.scanJobs(entityId, ['failed']);
    }
}

