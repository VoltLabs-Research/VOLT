import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface GetAnalysisByIdInputDTO {
    teamId?: string;
    analysisId: string;
}

export interface GetAnalysisByIdOutputDTO extends AnalysisProps {
    _id: string;
}
