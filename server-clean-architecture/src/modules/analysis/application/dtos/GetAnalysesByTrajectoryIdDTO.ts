import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface GetAnalysesByTrajectoryIdInputDTO {
    trajectoryId: string;
}

export interface GetAnalysesByTrajectoryIdOutputDTO extends PaginatedResult<AnalysisProps> {}
