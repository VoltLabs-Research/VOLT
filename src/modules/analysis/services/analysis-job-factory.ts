import { toTrajectoryFrameDumpObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { ANALYSIS_QUEUE_NAME } from '@core/constants/queue-names';
import type {
    AnalysisJobMetadata,
    AnalysisQueueJobPayload,
    AnalysisStartRequest,
    PlannedExecutionItem
} from '@shared/contracts/types/http-analysis';

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

export const buildItemAnalysisJob = (
    context: AnalysisJobFactoryContext,
    item: PlannedExecutionItem,
    index: number,
    timestep: number
): AnalysisQueueJobPayload => {
    const timestamp = new Date().toISOString();
    const inputFile = item.path ?? toTrajectoryFrameDumpObjectKey(context.input.trajectoryId, timestep);

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
            forEachIndex: index,
            windowMode: item.windowMode,
            windowSize: item.windowSize,
            referenceTimestep: item.referenceTimestep,
            windowTimesteps: item.windowTimesteps
        }
    };
};
