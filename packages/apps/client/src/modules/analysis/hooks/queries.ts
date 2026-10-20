import service from '../api/service';
import { removeEntityFromList } from '@/shared/query/cache-utils';
import queryClient from '@/shared/query/query-client';
import { buildKeys } from '@/shared/query/query-keys';
import { createInvalidatingMutation } from '@/shared/query/create-mutation';
import { createPaginatedQuery } from '@/shared/query/create-paginated-query';
import { createQuery, type QueryOptions } from '@/shared/query/create-query';
import { useCanvasAccessMode, useCanvasDataAccess, withAccessMode } from '@/modules/canvas/api/access/use-canvas-access-store';
import type { CanvasAccessMode } from '@/modules/canvas/contracts/data-access';
import type { CanvasDataAccess } from '@/modules/canvas/api/access/build-canvas-data-access';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { GetAnalysesByTrajectoryParams, GetAnalysesParams, RetryFailedFramesParams } from '../api/service';
import type { RetryFailedFramesResponse } from '@volt/contracts/modules/analysis/domain';

type AnalysisQueryKeys = Record<string, unknown> & {
    detail: string;
    byTrajectory: GetAnalysesByTrajectoryParams;
};

const BASE_KEY = 'analysis';

export const KEYS = buildKeys<AnalysisQueryKeys>(BASE_KEY);

export const isAnalysisByTrajectoryQueryKey = (queryKey: readonly unknown[]): boolean => {
    return queryKey.includes(BASE_KEY) && queryKey.includes('byTrajectory');
};

export const patchAnalysisByTrajectoryQueries = (
    updater: (page: PaginatedResponse<Analysis>) => PaginatedResponse<Analysis>
): void => {
    queryClient.setQueriesData<PaginatedResponse<Analysis>>(
        {
            predicate: (query) => isAnalysisByTrajectoryQueryKey(query.queryKey)
        },
        (current) => current ? updater(current) : current
    );
};

export const analysisQuery = createPaginatedQuery<Analysis, GetAnalysesParams>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    service: {
        list: service.getAll,
        delete: (id) => service.delete({ analysisId: id })
    },
    onRemove: (id) => {
        patchAnalysisByTrajectoryQueries((page) => removeEntityFromList(page, id));
    }
});

interface AnalysesByTrajectoryContext {
    mode: CanvasAccessMode;
    dataAccess: CanvasDataAccess;
    params: GetAnalysesByTrajectoryParams;
};

const analysesByTrajectoryQuery = createQuery<AnalysesByTrajectoryContext, PaginatedResponse<Analysis>>(
    ({ mode, params }) => withAccessMode(mode, KEYS.byTrajectory(params)),
    ({ dataAccess, params }) => dataAccess.getAnalysesByTrajectory(params)
);

export const useAnalysesByTrajectoryQuery = (
    params: GetAnalysesByTrajectoryParams,
    options?: QueryOptions<PaginatedResponse<Analysis>>
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return analysesByTrajectoryQuery({
        mode,
        dataAccess,
        params
    }, options);
};

export const useRetryFailedFramesMutation = createInvalidatingMutation<RetryFailedFramesResponse, RetryFailedFramesParams>(
    service.retryFailedFrames,
    [analysisQuery.QUERY_KEYS.lists(), KEYS.byTrajectory()]
);
