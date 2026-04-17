import { z } from 'zod';
import type { DaemonConfig } from '@/core/config';
import Redis from 'ioredis';

type TeamJobRecord = z.infer<typeof teamJobRecordSchema>;

interface RedisConnectionOptions {
    host: string;
    port: number;
    username?: string;
    password?: string;
};

const teamJobRecordSchema = z.object({
    jobId: z.string(),
    teamId: z.string(),
    queueType: z.string(),
    status: z.string(),
    timestamp: z.string().optional(),
    updatedAt: z.string().optional()
});

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const STATUS_TTL_SECONDS = 86_400;
const RENEW_EXPIRING_KEY_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`;
const DELETE_KEY_IF_VALUE_MATCHES_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
`;
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

export class RedisConnectionService {
    private readonly client: Redis;
    private readonly connectionOptions: RedisConnectionOptions;

    constructor(
        private readonly config: DaemonConfig
    ) {
        this.connectionOptions = {
            host: config.redis.host,
            port: config.redis.port,
            username: config.redis.username,
            password: config.redis.password
        };
        this.client = new Redis({
            ...this.getConnectionOptions(),
            maxRetriesPerRequest: null,
            lazyConnect: true
        });
    }

    readonly getConnectionOptions = (): RedisConnectionOptions => this.connectionOptions;

    async connect(): Promise<void> {
        if (this.client.status === 'ready') {
            return;
        }

        await this.client.connect();
    }

    readonly disconnect = async (): Promise<void> => {
        if (this.client.status === 'end') {
            return;
        }

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

    async projectJobStatuses(payloads: TeamJobRecord[]): Promise<void> {
        if (payloads.length === 0) {
            return;
        }

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

    async getTeamJobs(teamId: string): Promise<TeamJobRecord[]> {
        const setKey = `team:${teamId}:jobs`;
        const jobIds = await this.client.smembers(setKey);
        if (jobIds.length === 0) {
            return [];
        }

        const records = await this.client.mget(jobIds.map((jobId) => `${JOB_STATUS_KEY_PREFIX}${jobId}`));
        const jobs: TeamJobRecord[] = [];
        const staleJobIds: string[] = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            if (!record) {
                staleJobIds.push(jobIds[i]);
                continue;
            }

            try {
                const parsedRecord = teamJobRecordSchema.safeParse(JSON.parse(record));
                if (parsedRecord.success) jobs.push(parsedRecord.data);
            } catch {
                continue;
            }
        }

        if (staleJobIds.length > 0) {
            this.client.srem(setKey, ...staleJobIds).catch(() => {});
        }

        return jobs;
    }

    async removeJobs(teamId: string, jobIds: string[]): Promise<number> {
        if (jobIds.length === 0) {
            return 0;
        }

        const distinctJobIds = Array.from(new Set(jobIds));
        const pipeline = this.client.pipeline();

        for (const jobId of distinctJobIds) {
            pipeline.del(`${JOB_STATUS_KEY_PREFIX}${jobId}`);
        }
        pipeline.srem(`team:${teamId}:jobs`, ...distinctJobIds);

        const responses = await pipeline.exec() as [Error | null, number][];

        let deletedKeys = 0;

        for (const [index, [error, result]] of responses.entries()) {
            if (error) {
                throw error;
            }

            if (index < distinctJobIds.length) {
                deletedKeys += result;
            }
        }

        return deletedKeys;
    }

};
