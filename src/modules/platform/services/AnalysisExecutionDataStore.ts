import { logger } from '@/core/logger';
import {
    compressSerializedAnalysisExecutionData,
    parseStoredAnalysisExecutionData,
    serializeAnalysisExecutionData
} from '@/shared/utilities/analysis-execution-data';
import Redis from 'ioredis';
import type { DaemonConfig } from '@/core/config';
import type { AnalysisExecutionDataReference, AnalysisJobExecutionData } from '@/shared/contracts';

interface RedisConnectionOptions {
    host: string;
    port: number;
    username?: string;
    password?: string;
};

const ANALYSIS_EXECUTION_DATA_KEY_PREFIX = 'analysis:execution-data:';
const ANALYSIS_EXECUTION_DATA_TTL_SECONDS = 604_800;

const createAnalysisExecutionDataKey = (analysisId: string): string => {
    const randomSuffix = Math.random().toString(36).slice(2, 10);

    return `${ANALYSIS_EXECUTION_DATA_KEY_PREFIX}${analysisId}:${Date.now()}:${randomSuffix}`;
};

export class AnalysisExecutionDataStore {
    private readonly client: Redis;

    constructor(
        config: DaemonConfig
    ) {
        const connectionOptions: RedisConnectionOptions = {
            host: config.redis.host,
            port: config.redis.port,
            username: config.redis.username,
            password: config.redis.password
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
        const key = createAnalysisExecutionDataKey(executionData.analysisId);
        const serializedPayload = payload?.serializedPayload ?? serializeAnalysisExecutionData(executionData);
        const compressedPayload = payload?.compressedPayload ?? compressSerializedAnalysisExecutionData(serializedPayload);

        await this.client.set(key, compressedPayload, 'EX', ANALYSIS_EXECUTION_DATA_TTL_SECONDS);

        logger.info(
            {
                analysisId: executionData.analysisId,
                compressedExecutionDataBytes: Buffer.byteLength(compressedPayload),
                executionDataBytes: Buffer.byteLength(serializedPayload),
                key,
                ttlSeconds: ANALYSIS_EXECUTION_DATA_TTL_SECONDS
            },
            'Stored shared analysis execution data reference'
        );

        return {
            key,
            storedAt,
            ttlSeconds: ANALYSIS_EXECUTION_DATA_TTL_SECONDS
        };
    }

    async get(reference: AnalysisExecutionDataReference): Promise<AnalysisJobExecutionData | null> {
        await this.connect();

        const payload = await this.client.get(reference.key);
        if (!payload) {
            logger.warn(
                {
                    key: reference.key,
                    storedAt: reference.storedAt,
                    ttlSeconds: reference.ttlSeconds
                },
                'Shared analysis execution data reference was not found'
            );
            return null;
        }

        this.client.expire(reference.key, ANALYSIS_EXECUTION_DATA_TTL_SECONDS).catch(() => {});

        try {
            const parsedPayload = parseStoredAnalysisExecutionData(payload);

            logger.info(
                {
                    analysisId: parsedPayload.analysisId,
                    storedExecutionDataBytes: Buffer.byteLength(payload),
                    key: reference.key
                },
                'Resolved shared analysis execution data reference'
            );

            return parsedPayload;
        } catch (error: unknown) {
            logger.warn(
                {
                    err: error,
                    key: reference.key
                },
                'Failed to parse shared analysis execution data reference payload'
            );
            return null;
        }
    }
};
