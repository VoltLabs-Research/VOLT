import { singleton } from '@shared/application/utilities/singleton';
import { getDaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import { logger } from '@shared/infrastructure/logger';
import { compressSerializedAnalysisExecutionData, parseStoredAnalysisExecutionData, serializeAnalysisExecutionData } from '@shared/domain/utilities/analysis-execution-data';
import type { DaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import type { AnalysisExecutionDataReference, AnalysisJobExecutionData } from '@shared/contracts';

const ANALYSIS_EXECUTION_DATA_KEY_PREFIX = 'analysis:execution-data:';
const ANALYSIS_EXECUTION_DATA_TTL_SECONDS = 604_800;

/**
 * Holds the compressed execution payload that every job of an analysis reads.
 *
 * It is stored once under a reference rather than copied into each job's payload:
 * a pipeline can fan out to thousands of jobs over the same configuration, and the
 * payload is far larger than the reference to it.
 */
export class AnalysisDataStore {
    constructor(private readonly stateStore: DaemonStateStore) {}

    async store(
        executionData: AnalysisJobExecutionData,
        payload?: {
            serializedPayload?: string;
            compressedPayload?: string;
        }
    ): Promise<AnalysisExecutionDataReference> {
        const storedAt = new Date().toISOString();
        const key = this.createAnalysisExecutionDataKey(executionData.identity.analysisId);
        const serializedPayload = payload?.serializedPayload ?? serializeAnalysisExecutionData(executionData);
        const compressedPayload = payload?.compressedPayload ?? (await compressSerializedAnalysisExecutionData(serializedPayload));

        await this.stateStore.setValueWithTtl(key, compressedPayload, ANALYSIS_EXECUTION_DATA_TTL_SECONDS);

        return {
            key,
            storedAt,
            ttlSeconds: ANALYSIS_EXECUTION_DATA_TTL_SECONDS
        };
    }

    async get(reference: AnalysisExecutionDataReference, jobId?: string): Promise<AnalysisJobExecutionData> {
        const payload = await this.stateStore.getValue(reference.key);
        if (!payload) {
            throw new Error(
                `Shared analysis execution data reference was not found for job ${jobId ?? 'unknown'}`
            );
        }

        /*
         * Reading extends the deadline so a long-running analysis cannot have its
         * own configuration expire underneath its last jobs. Deliberately not
         * awaited: the payload is already in hand and a failed refresh must not
         * fail the read.
         */
        this.stateStore
            .setValueWithTtl(reference.key, payload, ANALYSIS_EXECUTION_DATA_TTL_SECONDS)
            .catch(() => {});

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

export const getAnalysisDataStore = singleton((): AnalysisDataStore => new AnalysisDataStore(getDaemonStateStore()));
