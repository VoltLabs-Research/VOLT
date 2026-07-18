import type { AnalysisFrameLogSnapshot } from '@shared/contracts/types/AnalysisFrameLog';

export interface GetAnalysisFrameLogInputDTO {
    teamId: string;
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

export type GetAnalysisFrameLogOutputDTO = AnalysisFrameLogSnapshot;
