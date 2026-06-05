export type AnalysisFrameLogStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalysisExecutionLogSegment {
    text: string;
    stream?: string;
    timestamp?: string;
}

export interface AnalysisFrameLogSnapshot {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    status: AnalysisFrameLogStatus;
    sealed: boolean;
    truncated: boolean;
    nextCursor: string | null;
    segments: AnalysisExecutionLogSegment[];
}

export interface GetFrameLogInput {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    afterCursor?: string;
}

export interface IAnalysisExecutionLogService {
    getFrameLog(input: GetFrameLogInput): Promise<AnalysisFrameLogSnapshot>;
    clearRuntimeState(analysisId: string): Promise<void>;
}
