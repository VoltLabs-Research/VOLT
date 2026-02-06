import { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface GetAnalysisByIdInputDTO{
    analysisId: string;
};

export interface GetAnalysisByIdOutputDTO extends AnalysisProps{}