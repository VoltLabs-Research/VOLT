import { DAEMON_TOKENS } from '../../core/tokens';
import { inject, injectable } from 'tsyringe';
import Redis from 'ioredis';
import type { DaemonConfig } from '../../core/config';
import type { ChildProcess } from 'node:child_process';

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

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

@injectable()
export class RedisConnectionService {
    private readonly client: Redis;
    private readonly activeProcesses = new Map<string, ChildProcess>();
    private readonly connectionOptions: RedisConnectionOptions;

    constructor(
        @inject(DAEMON_TOKENS.Config)
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

    async publish(channel: string, payload: Record<string, unknown>): Promise<void> {
        await this.client.publish(channel, JSON.stringify(payload));
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

    async removeJobs(teamId: string, jobIds: string[]): Promise<number> {
        if (jobIds.length === 0) {
            return 0;
        }

        const pipeline = this.client.pipeline();
        for (const jobId of jobIds) {
            pipeline.del(`${JOB_STATUS_KEY_PREFIX}${jobId}`);
        }
        pipeline.srem(`team:${teamId}:jobs`, ...jobIds);
        await pipeline.exec();

        return jobIds.length;
    }

    async clearTeamJobs(teamId: string): Promise<number> {
        const jobIds = await this.client.smembers(`team:${teamId}:jobs`);
        if (jobIds.length === 0) {
            return 0;
        }

        await this.removeJobs(teamId, jobIds);
        return jobIds.length;
    }

    registerActiveProcess(jobId: string, process: ChildProcess): void {
        this.activeProcesses.set(jobId, process);
    }

    unregisterActiveProcess(jobId: string): void {
        this.activeProcesses.delete(jobId);
    }

    stopActiveProcess(jobId: string): boolean {
        const process = this.activeProcesses.get(jobId);
        if (!process) {
            return false;
        }

        process.kill('SIGTERM');
        this.activeProcesses.delete(jobId);
        return true;
    }
};
