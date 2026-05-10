import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type {
    AnalysisJobMetadata,
    AnalysisQueueJobPayload,
    AnalysisStartRequest,
    PlannedExecutionItem
} from '@/modules/analysis/contracts/http-analysis';

export interface AnalysisJobFactoryContext {
    input: AnalysisStartRequest;
    serializedTraceContext?: Record<string, string>;
    totalItems: number;
}

const buildCommonJobFields = (context: AnalysisJobFactoryContext, timestamp: string) => ({
    name: context.input.pluginDisplayName,
    teamId: context.input.teamId,
    trajectoryId: context.input.trajectoryId,
    analysisId: context.input.analysisId,
    pluginId: context.input.pluginId,
    status: 'queued',
    queueType: ANALYSIS_QUEUE_NAME,
    createdAt: timestamp,
    updatedAt: timestamp
});

const buildCommonMetadata = (context: AnalysisJobFactoryContext): AnalysisJobMetadata => ({
    trajectoryId: context.input.trajectoryId,
    analysisId: context.input.analysisId,
    name: context.input.pluginDisplayName,
    config: context.input.config,
    plugin: context.input.pluginId,
    totalItems: context.totalItems,
    traceContext: context.serializedTraceContext
});

export const buildBatchAnalysisJob = (context: AnalysisJobFactoryContext): AnalysisQueueJobPayload => {
    const timestamp = new Date().toISOString();

    return {
        ...buildCommonJobFields(context, timestamp),
        jobId: `${context.input.analysisId}-batch-0`,
        metadata: {
            ...buildCommonMetadata(context),
            batchMode: true
        }
    };
};

export const buildItemAnalysisJob = (
    context: AnalysisJobFactoryContext,
    item: PlannedExecutionItem,
    index: number,
    timestep: number
): AnalysisQueueJobPayload => {
    const timestamp = new Date().toISOString();
    const inputFile = item.path ?? `trajectory-${context.input.trajectoryId}/timestep-${timestep}.dump.zst`;

    return {
        ...buildCommonJobFields(context, timestamp),
        jobId: `${context.input.analysisId}-${index}`,
        timestep,
        metadata: {
            ...buildCommonMetadata(context),
            timestep,
            inputFile,
            itemIndex: index,
            forEachItem: item,
            forEachIndex: index
        }
    };
};
