import IORedis from 'ioredis';
import { createRedisClient } from '@/config/redis';
import logger from '@/logger';

export interface ScanOptions {
    pattern: string;
    entityField?: string;
    entityId?: string;
    statusFilter?: string[];
}

class JobScanner {
    private redis: IORedis;

    constructor() {
        this.redis = createRedisClient();
    }

    async scan(options: ScanOptions): Promise<any[]> {
        const { pattern, entityField, entityId, statusFilter } = options;
        const jobs: any[] = [];
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

                        // Filter by entity if specified
                        if (entityField && entityId && job[entityField] !== entityId) continue;

                        // Filter by status if specified
                        if (statusFilter && !statusFilter.includes(job.status)) continue;

                        jobs.push({ ...job, redisKey: keys[i] });
                    } catch { /* skip invalid JSON */ }
                }
            }
        } while (cursor !== '0');

        return jobs;
    }

    async scanQueues(queueNames: string[], entityField?: string, entityId?: string, statusFilter?: string[]): Promise<any[]> {
        const allJobs: any[] = [];

        for (const queueName of queueNames) {
            const jobs = await this.scan({
                pattern: `${queueName}_queue:status:*`,
                entityField,
                entityId,
                statusFilter,
            });
            jobs.forEach(j => allJobs.push({ ...j, queueType: queueName }));
        }

        return allJobs;
    }

    async deleteJob(job: any, queueType?: string): Promise<void> {
        const { jobId, teamId } = job;
        const queue = queueType || job.queueType;

        if (queue && jobId) {
            await this.redis.del(`${queue}_queue:status:${jobId}`);
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
                logger.error(`[JobScanner] Failed to delete job ${job.jobId}: ${e}`);
            }
        }
        return count;
    }
}

export const jobScanner = new JobScanner();
