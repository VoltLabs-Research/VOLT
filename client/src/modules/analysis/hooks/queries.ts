import service from '../api/service';
import { patchPaginatedPage, removeEntityFromList } from '@/shared/infrastructure/query/cache-utils';
import queryClient from '@/shared/infrastructure/query/query-client';
import {
    buildKeys,
    createInvalidatingMutation,
    createPaginatedQuery,
    createQuery,
    type QueryOptions
} from '@/shared/infrastructure/query';
import {
    useCanvasAccessMode,
    useCanvasDataAccess,
    withAccessMode,
    type CanvasAccessMode,
    type CanvasDataAccess
} from '@/modules/canvas/api/access';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Analysis } from '../api/entities/analysis';
import type {
    GetAnalysesByTrajectoryParams,
    GetAnalysesParams,
    RetryFailedFramesParams,
    RetryFailedFramesResponse
} from '../api/service';

type AnalysisQueryKeys = Record<string, unknown> & {
    detail: string;
    byTrajectory: GetAnalysesByTrajectoryParams;
};

const BASE_KEY = 'analysis';

export const KEYS = buildKeys<AnalysisQueryKeys>(BASE_KEY);

const isAnalysisByTrajectoryQueryKey = (queryKey: readonly unknown[]): boolean => {
    return queryKey.some((entry) => entry === BASE_KEY)
        && queryKey.some((entry) => entry === 'byTrajectory');
};

const patchAnalysisByTrajectoryQueries = (
    updater: (page: PaginatedResponse<Analysis>) => PaginatedResponse<Analysis>
): void => {
    queryClient.setQueriesData<PaginatedResponse<Analysis>>(
        {
            predicate: (query) => Array.isArray(query.queryKey)
                && isAnalysisByTrajectoryQueryKey(query.queryKey)
        },
        (current) => {
            if (!current || !Array.isArray(current.data)) return current;
            return updater(current);
        }
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
        const removeFromPage = (page: PaginatedResponse<Analysis>) => removeEntityFromList(page, id);
        patchPaginatedPage<Analysis>(KEYS.byTrajectory(), removeFromPage);
        patchAnalysisByTrajectoryQueries(removeFromPage);
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

    return analysesByTrajectoryQuery({ mode, dataAccess, params }, options);
};

export const useRetryFailedFramesMutation = createInvalidatingMutation<RetryFailedFramesResponse, RetryFailedFramesParams>(
    service.retryFailedFrames,
    [analysisQuery.QUERY_KEYS.lists(), KEYS.byTrajectory()]
);
