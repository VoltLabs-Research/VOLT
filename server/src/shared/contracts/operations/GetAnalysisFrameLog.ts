import type { AnalysisFrameLogSnapshot } from '@shared/contracts/types/AnalysisFrameLog';

export interface GetAnalysisFrameLogInput {
    teamId: string;
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

export type GetAnalysisFrameLogOutput = AnalysisFrameLogSnapshot;
