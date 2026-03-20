import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { PaginatedResult, PopulatePath } from '@shared/domain/port/IBaseRepository';

interface AnalysisTeamSearchOptions {
    teamId: string;
    search: string;
    trajectoryIds?: string[];
    page?: number;
    limit?: number;
    populate?: string | string[] | PopulatePath | PopulatePath[];
}

export interface IAnalysisRepository extends IBaseRepository<Analysis, AnalysisProps> {
    getCompletedFramesByCluster(): Promise<Record<string, number>>;
    findByTeamAndSearch(options: AnalysisTeamSearchOptions): Promise<PaginatedResult<Analysis>>;
};
