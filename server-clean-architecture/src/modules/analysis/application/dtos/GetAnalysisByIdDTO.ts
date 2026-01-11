import { AnalysisProps } from "../../domain/entities/Analysis";

export interface GetAnalysisByIdInputDTO{
    analysisId: string;
};

export interface GetAnalysisByIdOutputDTO extends AnalysisProps{}