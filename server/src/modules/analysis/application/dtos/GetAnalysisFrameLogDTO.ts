import type { AnalysisFrameLogSnapshot } from '@modules/analysis/domain/port/IAnalysisExecutionLogService';

export interface GetAnalysisFrameLogInputDTO {
    teamId: string;
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

export type GetAnalysisFrameLogOutputDTO = AnalysisFrameLogSnapshot;
