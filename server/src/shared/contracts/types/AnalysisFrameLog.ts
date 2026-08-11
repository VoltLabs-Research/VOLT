import type { TeamClusterDaemonExecutionLogSegment } from '@shared/contracts/types/TeamClusterExposure';

export type AnalysisFrameLogStatus = 'pending' | 'running' | 'completed' | 'failed';

export type AnalysisExecutionLogSegment = TeamClusterDaemonExecutionLogSegment;

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
