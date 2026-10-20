import type {
    AnalysisExecutionLogSegment,
    AnalysisFrameLogSnapshot
} from '@shared/contracts/types/AnalysisFrameLog';

export interface AnalysisFrameLogIdentity {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
}

export interface AnalysisFrameLogJobIdentity extends AnalysisFrameLogIdentity {
    jobId: string;
}

export interface AppendFrameSegmentsInput extends AnalysisFrameLogJobIdentity {
    segments: AnalysisExecutionLogSegment[];
}

export interface SealFrameLogInput extends AnalysisFrameLogJobIdentity {
    status: 'completed' | 'failed';
}

export interface GetFrameLogInput extends AnalysisFrameLogIdentity {
    afterCursor?: string;
}

export interface StoredAnalysisFrameLogRecord extends AnalysisFrameLogSnapshot {
    jobId?: string;
    bytes?: number;
}
