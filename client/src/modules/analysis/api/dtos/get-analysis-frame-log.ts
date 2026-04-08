export type AnalysisLogStream = 'stdout' | 'stderr' | 'system';
export type AnalysisFrameLogStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalysisLogSegment {
    stream: AnalysisLogStream;
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
}

export interface GetAnalysisFrameLogParams {
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

export interface GetAnalysisFrameLogResponse {
    analysisId: string;
    timestep: number;
    status: AnalysisFrameLogStatus;
    sealed: boolean;
    truncated: boolean;
    nextCursor: string | null;
    segments: AnalysisLogSegment[];
}
