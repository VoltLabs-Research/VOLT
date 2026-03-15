import Redis from 'ioredis';
import type { DaemonConfig } from '@/core/config';
import { isRecord } from '@/shared/utils';

interface RedisConnectionOptions {
    host: string;
    port: number;
    username?: string;
    password?: string;
};

export interface TeamJobRecord {
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

    async projectJobStatus(payload: TeamJobRecord): Promise<void> {
        const timestamp = typeof payload.timestamp === 'string'
            ? payload.timestamp
            : new Date().toISOString();
        const updatedAt = typeof payload.updatedAt === 'string'
            ? payload.updatedAt
            : new Date().toISOString();
        const statusKey = `${JOB_STATUS_KEY_PREFIX}${payload.jobId}`;
        const pipeline = this.client.pipeline();

        pipeline.set(statusKey, JSON.stringify({
            ...payload,
            timestamp,
            updatedAt
        }), 'EX', STATUS_TTL_SECONDS);
        pipeline.sadd(`team:${payload.teamId}:jobs`, payload.jobId);
        await pipeline.exec();
    }

    async getTeamJobs(teamId: string): Promise<TeamJobRecord[]> {
        const jobIds = await this.client.smembers(`team:${teamId}:jobs`);
        if (jobIds.length === 0) {
            return [];
        }

        const records = await this.client.mget(jobIds.map((jobId) => `${JOB_STATUS_KEY_PREFIX}${jobId}`));
        const jobs: TeamJobRecord[] = [];

        for (const record of records) {
            if (!record) {
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

    async listExplorerDatabases(): Promise<Array<{ databaseId: number; keyCount: number; }>> {
        const info = await this.client.info('keyspace');
        const matches = Array.from(info.matchAll(/db(\d+):keys=(\d+)/g));

        if (matches.length === 0) {
            return [{
                databaseId: 0,
                keyCount: 0
            }];
        }

        return matches.map((match) => ({
            databaseId: Number(match[1]),
            keyCount: Number(match[2])
        }));
    }

    async listExplorerKeys(databaseId: number, limit = 200): Promise<string[]> {
        const client = new Redis({
            ...this.connectionOptions,
            db: databaseId,
            lazyConnect: true
        });

        try {
            await client.connect();
            let cursor = '0';
            const keys: string[] = [];

            do {
                const [nextCursor, nextKeys] = await client.scan(cursor, 'COUNT', 100);
                cursor = nextCursor;
                keys.push(...nextKeys);
            } while (cursor !== '0' && keys.length < limit);

            return keys.slice(0, limit);
        } finally {
            await client.quit();
        }
    }

    async getExplorerValue(databaseId: number, key: string): Promise<{ type: string; value: unknown; }> {
        const client = new Redis({
            ...this.connectionOptions,
            db: databaseId,
            lazyConnect: true
        });

        try {
            await client.connect();
            const type = await client.type(key);

            if (type === 'string') {
                return { type, value: await client.get(key) };
            }

            if (type === 'hash') {
                return { type, value: await client.hgetall(key) };
            }

            if (type === 'list') {
                return { type, value: await client.lrange(key, 0, 99) };
            }

            if (type === 'set') {
                return { type, value: await client.smembers(key) };
            }

            if (type === 'zset') {
                return { type, value: await client.zrange(key, 0, 99, 'WITHSCORES') };
            }

            if (type === 'stream') {
                return { type, value: await client.xrange(key, '-', '+', 'COUNT', 100) };
            }

            return {
                type,
                value: null
            };
        } finally {
            await client.quit();
        }
    }
};
