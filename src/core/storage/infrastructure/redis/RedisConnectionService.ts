import { isRecord } from '@/support/type-guards/isRecord';
import Redis from 'ioredis';
import type { DaemonConfig } from '@/core/config';

interface RedisConnectionOptions {
    host: string;
    port: number;
    username?: string;
    password?: string;
};

interface TeamJobRecord {
    jobId: string;
    teamId: string;
    queueType: string;
    status: string;
    timestamp?: string;
    updatedAt?: string;
    [key: string]: unknown;
};

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

const countDeletedJobStatusKeys = (
    responses: Array<[Error | null, unknown]> | null,
    deleteCommandCount: number
): number => {
    if (!responses) {
        return 0;
    }

    let deletedKeys = 0;

    for (const [index, [error, result]] of responses.entries()) {
        if (error) {
            throw error;
        }

        if (index < deleteCommandCount && typeof result === 'number') {
            deletedKeys += result;
        }
    }

    return deletedKeys;
};

const getDistinctJobIds = (jobIds: string[]): string[] => {
    return Array.from(new Set(jobIds));
};


const isTeamJobRecord = (value: unknown): value is TeamJobRecord => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.jobId === 'string'
        && typeof value.teamId === 'string'
        && typeof value.queueType === 'string'
        && typeof value.status === 'string';
};

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
            ...this.connectionOptions,
            maxRetriesPerRequest: null,
            lazyConnect: true
        });
    }

    getConnectionOptions(): RedisConnectionOptions {
        return this.connectionOptions;
    }

    async connect(): Promise<void> {
        if (this.client.status === 'ready') {
            return;
        }

        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        if (this.client.status === 'end') {
            return;
        }

        await this.client.quit();
    }

    async setKeyIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
        await this.connect();

        const result = typeof ttlSeconds === 'number'
            ? await this.client.set(key, value, 'EX', ttlSeconds, 'NX')
            : await this.client.set(key, value, 'NX');

        return result === 'OK';
    }

    async setExpiringKeyIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
        await this.connect();

        const result = await this.client.set(key, value, 'PX', ttlMs, 'NX');
        return result === 'OK';
    }

    async renewExpiringKeyIfValueMatches(key: string, expectedValue: string, ttlMs: number): Promise<boolean> {
        await this.connect();

        const result = await this.client.eval(
            RENEW_EXPIRING_KEY_SCRIPT,
            1,
            key,
            expectedValue,
            String(ttlMs)
        );

        return result === 1;
    }

    async deleteKeyIfValueMatches(key: string, expectedValue: string): Promise<boolean> {
        await this.connect();

        const result = await this.client.eval(
            DELETE_KEY_IF_VALUE_MATCHES_SCRIPT,
            1,
            key,
            expectedValue
        );

        return result === 1;
    }

    async tryAcquireExpiringSlot(key: string, token: string, limit: number, ttlMs: number): Promise<boolean> {
        await this.connect();

        const now = Date.now();
        const expiresAt = now + ttlMs;
        const result = await this.client.eval(
            ACQUIRE_EXPIRING_SLOT_SCRIPT,
            1,
            key,
            String(now),
            String(expiresAt),
            String(limit),
            token,
            String(ttlMs)
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
            String(now),
            String(expiresAt),
            token,
            String(ttlMs)
        );

        return result === 1;
    }

    async releaseExpiringSlot(key: string, token: string, ttlMs: number): Promise<boolean> {
        await this.connect();

        const result = await this.client.eval(
            RELEASE_EXPIRING_SLOT_SCRIPT,
            1,
            key,
            token,
            String(ttlMs)
        );

        return result === 1;
    }

    async deleteKey(key: string): Promise<number> {
        await this.connect();

        return this.client.del(key);
    }

    async projectJobStatuses(payloads: TeamJobRecord[]): Promise<void> {
        if (payloads.length === 0) {
            return;
        }

        await this.connect();

        const pipeline = this.client.pipeline();

        for (const payload of payloads) {
            const timestamp = typeof payload.timestamp === 'string'
                ? payload.timestamp
                : new Date().toISOString();
            const updatedAt = typeof payload.updatedAt === 'string'
                ? payload.updatedAt
                : new Date().toISOString();
            const statusKey = `${JOB_STATUS_KEY_PREFIX}${payload.jobId}`;

            pipeline.set(statusKey, JSON.stringify({
                ...payload,
                timestamp,
                updatedAt
            }), 'EX', STATUS_TTL_SECONDS);
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
                const parsedRecord: unknown = JSON.parse(record);
                if (isTeamJobRecord(parsedRecord)) {
                    jobs.push(parsedRecord);
                }
            } catch {
                continue;
            }
        }

        if (staleJobIds.length > 0) {
            this.client.srem(setKey, ...staleJobIds).catch(() => {});
        }

        return jobs;
    }

    async getJobRecord(jobId: string): Promise<TeamJobRecord | null> {
        const record = await this.client.get(`${JOB_STATUS_KEY_PREFIX}${jobId}`);
        if (!record) {
            return null;
        }

        try {
            const parsedRecord: unknown = JSON.parse(record);
            if (!isTeamJobRecord(parsedRecord)) {
                return null;
            }

            return parsedRecord;
        } catch {
            return null;
        }
    }

    async removeJobs(teamId: string, jobIds: string[]): Promise<number> {
        if (jobIds.length === 0) {
            return 0;
        }

        const distinctJobIds = getDistinctJobIds(jobIds);
        const pipeline = this.client.pipeline();

        for (const jobId of distinctJobIds) {
            pipeline.del(`${JOB_STATUS_KEY_PREFIX}${jobId}`);
        }
        pipeline.srem(`team:${teamId}:jobs`, ...distinctJobIds);

        const responses = await pipeline.exec();

        return countDeletedJobStatusKeys(responses, distinctJobIds.length);
    }

    async clearTeamJobs(teamId: string): Promise<number> {
        const jobIds = await this.client.smembers(`team:${teamId}:jobs`);
        if (jobIds.length === 0) {
            return 0;
        }

        return this.removeJobs(teamId, jobIds);
    }

};
