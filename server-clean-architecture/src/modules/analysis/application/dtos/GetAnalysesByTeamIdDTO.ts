import { PaginatedResult } from "@/src/shared/domain/ports/IBaseRepository";
import { AnalysisProps } from "../../domain/entities/Analysis";

export interface GetAnalysesByTeamIdInputDTO{
    teamId: string;
}

export interface GetAnalysesByTeamIdOutputDTO extends PaginatedResult<AnalysisProps>{}