import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import Analysis, { AnalysisProps } from '../entities/Analysis';

export interface IAnalysisRepository extends IBaseRepository<Analysis, AnalysisProps>{
    /**
     * Retry failed frames for the specified analysis id.
     */
    retryFailedFrames(analysisId: string): Promise<void>;
};