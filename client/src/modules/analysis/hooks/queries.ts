import service from '../api/service';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { patchPaginatedPage, removeEntityFromList } from '@/shared/infrastructure/query/cache-utils';
import { buildKeys, createInvalidatingMutation, createPaginatedQuery } from '@/shared/infrastructure/query/create-paginated-query';
import { useCanvasAccessMode, useCanvasDataAccess, withAccessMode } from '@/modules/canvas/api/access';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Analysis } from '../api/entities/analysis';
import type { GetAnalysesParams } from '../api/dtos/get-analyses';
import type { GetAnalysesByTrajectoryParams } from '../api/dtos/get-analyses-by-trajectory';
import type { RetryFailedFramesParams, RetryFailedFramesResponse } from '../api/dtos/retry-failed-frames';

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

type AnalysesByTrajectoryQueryOptions = Partial<UseQueryOptions<PaginatedResponse<Analysis>, Error, PaginatedResponse<Analysis>>>;

export const useAnalysesByTrajectoryQuery = (
    params: GetAnalysesByTrajectoryParams,
    options?: AnalysesByTrajectoryQueryOptions
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useQuery<PaginatedResponse<Analysis>, Error, PaginatedResponse<Analysis>>({
        ...options,
        queryKey: withAccessMode(mode, KEYS.byTrajectory(params)),
        queryFn: () => dataAccess.getAnalysesByTrajectory(params)
    });
};

export const useRetryFailedFramesMutation = createInvalidatingMutation<RetryFailedFramesResponse, RetryFailedFramesParams>(
    service.retryFailedFrames,
    [analysisQuery.QUERY_KEYS.lists(), KEYS.byTrajectory()]
);
