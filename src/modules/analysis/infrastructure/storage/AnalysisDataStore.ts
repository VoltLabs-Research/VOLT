import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { compressSerializedAnalysisExecutionData, parseStoredAnalysisExecutionData, serializeAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import Redis from 'ioredis';
import type { DaemonConfig } from '@/core/config';
import type { AnalysisExecutionDataReference, AnalysisJobExecutionData } from '@/contracts';
import type { RedisConnectionOptions } from '@/core/storage/contracts/redis-connection';

interface AnalysisExecutionDataPayload {
    jobId: string;
    executionDataReference: AnalysisExecutionDataReference;
}

const ANALYSIS_EXECUTION_DATA_KEY_PREFIX = 'analysis:execution-data:';
const ANALYSIS_EXECUTION_DATA_TTL_SECONDS = 604_800;

@Service('analysisDataStore')
export class AnalysisDataStore {
    private readonly client: Redis;

    constructor(
        config: DaemonConfig
    ) {
        const connectionOptions: RedisConnectionOptions = {
            host: config.redis.host,
            port: config.redis.port,
            username: config.redis.username,
            password: config.redis.password,
            keyPrefix: config.redis.keyPrefix
        };

        this.client = new Redis({
            ...connectionOptions,
            maxRetriesPerRequest: null,
            lazyConnect: true
        });
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

    async store(
        executionData: AnalysisJobExecutionData,
        payload?: {
            serializedPayload?: string;
            compressedPayload?: string;
        }
    ): Promise<AnalysisExecutionDataReference> {
        await this.connect();

        const storedAt = new Date().toISOString();
        const key = this.createAnalysisExecutionDataKey(executionData.identity.analysisId);
        const serializedPayload = payload?.serializedPayload ?? serializeAnalysisExecutionData(executionData);
        const compressedPayload = payload?.compressedPayload ?? (await compressSerializedAnalysisExecutionData(serializedPayload));

        await this.client.set(key, compressedPayload, 'EX', ANALYSIS_EXECUTION_DATA_TTL_SECONDS);

        return {
            key,
            storedAt,
            ttlSeconds: ANALYSIS_EXECUTION_DATA_TTL_SECONDS
        };
    }

    async resolve(payload: AnalysisExecutionDataPayload): Promise<AnalysisJobExecutionData> {
        return this.get(payload.executionDataReference, payload.jobId);
    }

    async get(reference: AnalysisExecutionDataReference, jobId?: string): Promise<AnalysisJobExecutionData> {
        await this.connect();

        const payload = await this.client.get(reference.key);
        if (!payload) {
            throw new Error(
                `Shared analysis execution data reference was not found for job ${jobId ?? 'unknown'}`
            );
        }

        this.client.expire(reference.key, ANALYSIS_EXECUTION_DATA_TTL_SECONDS).catch(() => {});

        try {
            return await parseStoredAnalysisExecutionData(payload);
        } catch (error: unknown) {
            logger.warn(
                {
                    err: error,
                    key: reference.key
                },
                'Failed to parse shared analysis execution data reference payload'
            );
            throw new Error(
                `Shared analysis execution data reference payload is invalid for job ${jobId ?? 'unknown'}`
            );
        }
    }

    private createAnalysisExecutionDataKey(analysisId: string): string {
        const randomSuffix = Math.random().toString(36).slice(2, 10);

        return `${ANALYSIS_EXECUTION_DATA_KEY_PREFIX}${analysisId}:${Date.now()}:${randomSuffix}`;
    }
};
