import service from '../api/service';
import { removeEntityFromList } from '@/shared/query/cache-utils';
import queryClient from '@/shared/query/query-client';
import {
    buildKeys,
    createInvalidatingMutation,
    createPaginatedQuery,
    createQuery,
    type QueryOptions
} from '@/shared/query';
import {
    useCanvasAccessMode,
    useCanvasDataAccess,
    withAccessMode,
    type CanvasAccessMode,
    type CanvasDataAccess
} from '@/modules/canvas/api/access';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { GetAnalysesByTrajectoryParams, GetAnalysesParams, RetryFailedFramesParams } from '../api/service';
import type { RetryFailedFramesResponse } from '@volt/contracts/modules/analysis/domain';

type AnalysisQueryKeys = Record<string, unknown> & {
    detail: string;
    byTrajectory: GetAnalysesByTrajectoryParams;
};

const BASE_KEY = 'analysis';

export const KEYS = buildKeys<AnalysisQueryKeys>(BASE_KEY);

// `byTrajectory` queries are keyed through `withAccessMode`, so their keys are prefixed with
// the canvas access segments and can only be reached by matching segments, not by key prefix.
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
