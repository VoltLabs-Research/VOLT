import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface IAnalysisRepository extends IBaseRepository<Analysis, AnalysisProps> {
    getCompletedFramesByCluster(): Promise<Record<string, number>>;
};
