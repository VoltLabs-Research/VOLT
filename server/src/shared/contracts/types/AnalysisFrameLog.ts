import type { TeamClusterDaemonExecutionLogSegment } from '@shared/contracts/types';

/**
 * Neutral analysis frame-log snapshot types (detachable-modules migration).
 * Consumed cross-module (trajectory public-canvas frame-log view). Owner:
 * analysis module, which re-exports these from
 * `@modules/analysis/ports/IAnalysisExecutionLogService`.
 */
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
