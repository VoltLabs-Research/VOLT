/**
 * Canonical, neutral repository-port contract for the Analysis domain.
 * Extracted from `@modules/analysis/domain/port/IAnalysisRepository` during the
 * detachable-modules migration. The entity/props types it references come from
 * the neutral contracts layer (`@shared/contracts/types/AnalysisProps`), so this
 * port has no `@modules/*` coupling. The original owner file re-exports every
 * name below, so existing importers compile unchanged.
 */
import type { IBaseRepository, PaginatedResult, PopulatePath } from '@shared/domain/port/IBaseRepository';
import type { Analysis, AnalysisProps } from '@shared/contracts/types/AnalysisProps';

export interface AnalysisTeamSearchOptions {
    teamId: string;
    search: string;
    trajectoryIds?: string[];
    page?: number;
    limit?: number;
    populate?: string | string[] | PopulatePath | PopulatePath[];
}

export interface AnalysisRuntimeTarget {
    analysisId: string;
    computeClusterId: string | undefined;
}

export interface IAnalysisRepository extends IBaseRepository<Analysis, AnalysisProps> {
    findByTeamAndSearch(options: AnalysisTeamSearchOptions): Promise<PaginatedResult<Analysis>>;
    findRuntimeTargetsByTrajectoryId(trajectoryId: string): Promise<AnalysisRuntimeTarget[]>;
}
