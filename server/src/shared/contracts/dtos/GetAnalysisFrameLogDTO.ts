import type { AnalysisFrameLogSnapshot } from '@shared/contracts/types/AnalysisFrameLog';

/**
 * Neutral DTOs for the get-analysis-frame-log use case (detachable-modules
 * migration). Owner module re-exports these.
 */
export interface GetAnalysisFrameLogInputDTO {
    teamId: string;
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

export type GetAnalysisFrameLogOutputDTO = AnalysisFrameLogSnapshot;
