import AnalysisEntity from '@modules/analysis/models/Analysis';
import { buildAnalysisRelationOptions } from '@modules/analysis/services/AnalysisQueries';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';

import type { AnalysisRelationName } from '@modules/analysis/contracts/analysis';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { FindOptionsOrder, FindOptionsWhere } from 'typeorm';

const ANALYSIS_LIST_DEFAULT_LIMIT = 100;
export const ANALYSIS_LIST_MAX_LIMIT = 1000;

interface FindAnalysesOptions{
    where: FindOptionsWhere<AnalysisEntity>;
    relations?: readonly AnalysisRelationName[];
    order?: FindOptionsOrder<AnalysisEntity>;
    page?: number;
    limit?: number;
}

export const findAnalyses = async (options: FindAnalysesOptions): Promise<PaginatedResult<AnalysisEntity>> => {
    const { where, relations, order } = options;
    const pageRequest = readPageRequest(options.page, options.limit, {
        defaultLimit: ANALYSIS_LIST_DEFAULT_LIMIT,
        maxLimit: ANALYSIS_LIST_MAX_LIMIT
    });

    const [analyses, total] = await AnalysisEntity.findAndCount({
        where,
        ...buildAnalysisRelationOptions(relations),
        ...(order === undefined ? {} : { order }),
        skip: skipFor(pageRequest),
        take: pageRequest.limit
    });

    return paginate([analyses, total], pageRequest);
};

export const storageClusterIdOf = (trajectory: { storageClusterId?: string }): string | undefined => (
    trajectory.storageClusterId ? String(trajectory.storageClusterId) : undefined
);
