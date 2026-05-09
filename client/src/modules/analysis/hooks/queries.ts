import service from '../api/service';
import { patchPaginatedPage, removeEntityFromList } from '@/shared/infrastructure/query/cache-utils';
import {
    buildKeys,
    createInvalidatingMutation,
    createPaginatedQuery,
    createQuery,
    type QueryOptions
} from '@/shared/infrastructure/query/create-paginated-query';
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

export const analysisQuery = createPaginatedQuery<Analysis, GetAnalysesParams>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    service: {
        list: service.getAll,
        delete: (id) => service.delete({ analysisId: id })
    },
    onRemove: (id) => {
        patchPaginatedPage<Analysis>(KEYS.byTrajectory(), (page) => removeEntityFromList(page, id));
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
