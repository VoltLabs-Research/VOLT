import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Analysis, { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface IAnalysisRepository extends IBaseRepository<Analysis, AnalysisProps>{
    getCompletedFramesByCluster(): Promise<Record<string, number>>;
};
