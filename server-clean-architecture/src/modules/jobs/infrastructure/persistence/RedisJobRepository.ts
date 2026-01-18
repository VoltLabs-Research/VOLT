import IORedis from 'ioredis';
import { IJobRepository } from '@modules/jobs/domain/ports/IJobRepository';
import { injectable, inject } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

@injectable()
export default class RedisJobRepository implements IJobRepository {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(SHARED_TOKENS.RedisBlockingClient)
        private readonly redisBlocking: IORedis
    ) { }

    async addToQueue(queueKey: string, jobs: string[]): Promise<void> {
        if (jobs.length === 0) return;

        await this.redis.lpush(queueKey, ...jobs);
    }

    async getFromQueue(
        queueKey: string,
        processingKey: string,
        timeoutSeconds: number
    ): Promise<string | null> {
        const result = await this.redisBlocking.blmove(
            queueKey,
            processingKey,
            'RIGHT',
            'LEFT',
            timeoutSeconds
        );

        return typeof result === 'string' ? result : null;
    }

    async getMultipleFromQueue(
        queueKey: string,
        processingKey: string,
        count: number
    ): Promise<string[]> {
        const jobs: string[] = [];
        for (let i = 0; i < count; i++) {
            const job = await this.redis.lmove(
                queueKey,
                processingKey,
                'RIGHT',
                'LEFT'
            );

            if (!job) break;
            jobs.push(job);
        }

        return jobs;
    }

    async moveToQueue(
        queueKey: string,
        processingKey: string,
        rawData: string
    ): Promise<void> {
        await this.redis.multi()
            .lpush(queueKey, rawData)
            .lrem(processingKey, 1, rawData)
            .exec();
    }

    async removeFromProcessing(
        processingKey: string,
        rawData: string
    ): Promise<void> {
        await this.redis.lrem(processingKey, 1, rawData);
    }

    async getQueueLength(queueKey: string): Promise<number> {
        return await this.redis.llen(queueKey);
    }

    async getProcessingLength(processingKey: string): Promise<number> {
        return await this.redis.llen(processingKey);
    }

    async setJobStatus(
        statusKey: string,
        data: any,
        ttlSeconds: number
    ): Promise<void> {
        await this.redis.set(
            statusKey,
            JSON.stringify(data),
            'EX',
            ttlSeconds
        );
    }

    async getJobStatus(statusKey: string): Promise<any | null> {
        const data = await this.redis.get(statusKey);
        if (!data) return null;

        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    async deleteJobStatus(statusKey: string): Promise<void> {
        await this.redis.del(statusKey);
    }

    async incrementRetryCounter(retryKey: string, ttlSeconds: number): Promise<number> {
        const count = this.redis.incr(retryKey);
        await this.redis.expire(retryKey, ttlSeconds);
        return count;
    }

    async deleteRetryCounter(retryKey: string): Promise<void> {
        await this.redis.del(retryKey);
    }

    async addToTeamJobs(teamId: string, jobId: string): Promise<void> {
        const teamJobsKey = `team:${teamId}:jobs`;
        await this.redis.sadd(teamJobsKey, jobId);
    }

    async getTeamJobIds(teamId: string): Promise<string[]> {
        const teamJobsKey = `team:${teamId}:jobs`;
        return await this.redis.smembers(teamJobsKey);
    }

    async evalScript(
        script: string,
        numKeys: number,
        ...args: (string | number)[]
    ): Promise<any> {
        return await this.redis.eval(script, numKeys, ...args);
    }

    async getListRange(
        key: string,
        start: number,
        end: number
    ): Promise<string[]> {
        return await this.redis.lrange(key, start, end);
    }

    async exists(key: string): Promise<number> {
        return await this.redis.exists(key);
    }

    async setWithExpiry(
        key: string,
        value: string,
        expirySeconds: number
    ): Promise<void> {
        await this.redis.setex(key, expirySeconds, value);
    }

    async delete(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async get(key: string): Promise<string | null> {
        return await this.redis.get(key);
    }

    async scan(
        cursor: string,
        pattern: string,
        count: number
    ): Promise<[string, string[]]> {
        const result = await this.redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            count
        );
        return [result[0], result[1]];
    }

    pipeline() {
        return this.redis.pipeline();
    }

    multi() {
        return this.redis.multi();
    }
};