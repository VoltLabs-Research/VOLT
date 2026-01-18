import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import Analysis, { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface IAnalysisRepository extends IBaseRepository<Analysis, AnalysisProps>{
    /**
     * Retry failed frames for the specified analysis id.
     */
    retryFailedFrames(analysisId: string): Promise<void>;
};