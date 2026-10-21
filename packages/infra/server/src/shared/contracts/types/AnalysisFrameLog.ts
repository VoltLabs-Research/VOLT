import type { ExecutionLogSegment } from '@volt/contracts/modules/cluster/daemon-events';

export type AnalysisFrameLogStatus = 'pending' | 'running' | 'completed' | 'failed';

export type AnalysisExecutionLogSegment = ExecutionLogSegment;

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
