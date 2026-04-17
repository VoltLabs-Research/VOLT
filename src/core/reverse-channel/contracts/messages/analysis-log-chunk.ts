export interface AnalysisLogChunkSegment {
    executionPath?: string[];
    nodeId?: string;
    nodeLabel?: string;
    nodeType?: string;
    occurredAt: string;
    pluginId?: string;
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
}

export interface AnalysisLogChunkMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

export interface AnalysisLogChunkMessagePayload {
    analysisId: string;
    jobId: string;
    segments: AnalysisLogChunkSegment[];
    teamId: string;
    timestep: number;
    trajectoryId: string;
}

export interface AnalysisLogChunkMessage extends AnalysisLogChunkMessageContext, AnalysisLogChunkMessagePayload {
    type: 'analysis-log-chunk';
}

export const createAnalysisLogChunkMessage = (
    context: AnalysisLogChunkMessageContext,
    payload: AnalysisLogChunkMessagePayload
): AnalysisLogChunkMessage => ({
    type: 'analysis-log-chunk',
    ...context,
    ...payload
});
