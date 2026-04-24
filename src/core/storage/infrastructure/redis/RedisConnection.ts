import type { DaemonConfig } from '@/core/config';
import { Service } from '@/core/decorators/service';
import type { RedisConnectionOptions } from '@/core/storage/contracts/redis-connection';
import Redis from 'ioredis';

interface TeamJobRecord {
    jobId: string;
    teamId: string;
    queueType: string;
    status: string;
    timestamp?: string;
    updatedAt?: string;
}

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const STATUS_TTL_SECONDS = 86_400;

const ACQUIRE_EXPIRING_SLOT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local current = redis.call('ZCARD', KEYS[1])
if current < tonumber(ARGV[3]) then
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
    redis.call('PEXPIRE', KEYS[1], ARGV[5])
    return 1
end
return 0
`;

const RENEW_EXPIRING_SLOT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local score = redis.call('ZSCORE', KEYS[1], ARGV[3])
if score then
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
    redis.call('PEXPIRE', KEYS[1], ARGV[4])
    return 1
end
return 0
`;

const RELEASE_EXPIRING_SLOT_SCRIPT = `
local removed = redis.call('ZREM', KEYS[1], ARGV[1])
local remaining = redis.call('ZCARD', KEYS[1])
if remaining <= 0 then
    redis.call('DEL', KEYS[1])
else
    redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return removed
`;

@Service('redisConnection')
export class RedisConnection {
    private readonly client: Redis;
    private readonly connectionOptions: RedisConnectionOptions;

    constructor(
        private readonly config: DaemonConfig
    ) {
        this.connectionOptions = {
            host: config.redis.host,
            port: config.redis.port,
            username: config.redis.username,
            password: config.redis.password,
            keyPrefix: config.redis.keyPrefix
        };

        this.client = new Redis({
            ...this.connectionOptions,
            maxRetriesPerRequest: null,
            lazyConnect: true
        });
    }

    async connect(): Promise<void> {
        if (this.client.status === 'ready') return;

        await this.client.connect();
    }

    getConnectionOptions(): RedisConnectionOptions {
        return this.connectionOptions;
    }

    readonly disconnect = async (): Promise<void> => {
        if (this.client.status === 'end') return;

        await this.client.quit();
    };

    readonly setKeyIfAbsent = async (key: string, value: string, ttlSeconds?: number): Promise<boolean> => {
        await this.connect();

        const result = ttlSeconds === undefined
            ? await this.client.set(key, value, 'NX')
            : await this.client.set(key, value, 'EX', ttlSeconds, 'NX');

        return result === 'OK';
    };

    async tryAcquireExpiringSlot(key: string, token: string, limit: number, ttlMs: number): Promise<boolean> {
        await this.connect();

        const now = Date.now();
        const expiresAt = now + ttlMs;
        const result = await this.client.eval(
            ACQUIRE_EXPIRING_SLOT_SCRIPT,
            1,
            key,
            now.toString(),
            expiresAt.toString(),
            limit.toString(),
            token,
            ttlMs.toString()
        );

        return result === 1;
    }

    async renewExpiringSlot(key: string, token: string, ttlMs: number): Promise<boolean> {
        await this.connect();

        const now = Date.now();
        const expiresAt = now + ttlMs;
        const result = await this.client.eval(
            RENEW_EXPIRING_SLOT_SCRIPT,
            1,
            key,
            now.toString(),
            expiresAt.toString(),
            token,
            ttlMs.toString()
        );

        return result === 1;
    }

    readonly releaseExpiringSlot = async (key: string, token: string, ttlMs: number): Promise<boolean> => {
        await this.connect();

        const result = await this.client.eval(
            RELEASE_EXPIRING_SLOT_SCRIPT,
            1,
            key,
            token,
            ttlMs.toString()
        );

        return result === 1;
    };

    readonly deleteKey = async (key: string): Promise<number> => {
        await this.connect();

        return this.client.del(key);
    };

    readonly getValue = async (key: string): Promise<string | null> => {
        await this.connect();

        return this.client.get(key);
    };

    readonly setValueWithTtl = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
        await this.connect();

        await this.client.setex(key, ttlSeconds, value);
    };

    async projectJobStatuses(payloads: TeamJobRecord[]): Promise<void> {
        if (payloads.length === 0) return;

        await this.connect();

        const pipeline = this.client.pipeline();

        for (const payload of payloads) {
            const now = new Date().toISOString();
            const statusKey = `${JOB_STATUS_KEY_PREFIX}${payload.jobId}`;

            payload.timestamp ??= now;
            payload.updatedAt ??= now;

            pipeline.set(statusKey, JSON.stringify(payload), 'EX', STATUS_TTL_SECONDS);
            pipeline.sadd(`team:${payload.teamId}:jobs`, payload.jobId);
        }

        await pipeline.exec();
    }

    async removeJobs(teamId: string, jobIds: string[]): Promise<number> {
        if (jobIds.length === 0) return 0;

        const distinctJobIds = Array.from(new Set(jobIds));
        const pipeline = this.client.pipeline();

        for (const jobId of distinctJobIds) {
            pipeline.del(`${JOB_STATUS_KEY_PREFIX}${jobId}`);
        }

        pipeline.srem(`team:${teamId}:jobs`, ...distinctJobIds);

        const responses = await pipeline.exec() as [Error | null, number][];
        let deletedKeys = 0;

        for (const [index, [error, result]] of responses.entries()) {
            if (error) throw error;

            if (index < distinctJobIds.length) {
                deletedKeys += result;
            }
        }

        return deletedKeys;
    }
};
