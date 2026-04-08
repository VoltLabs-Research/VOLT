import type { AnalysisFrameLogSnapshot } from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';

export interface GetAnalysisFrameLogInputDTO {
    teamId: string;
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

export type GetAnalysisFrameLogOutputDTO = AnalysisFrameLogSnapshot;
