import service from '../api/service';
import { patchTrajectoryDetailCaches } from '@/modules/trajectory/shared/cache';
import { patchPaginatedPage, removeEntityFromList } from '@/shared/infrastructure/query/cache-utils';
import { buildKeys, createInvalidatingMutation, createPaginatedQuery, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
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
        patchTrajectoryDetailCaches((trajectory) => ({
            ...trajectory,
            analysis: (trajectory.analysis ?? []).filter((a) => a._id !== id)
        }));
    }
});

export const useAnalysesByTrajectoryQuery = createQuery(KEYS.byTrajectory, service.getByTrajectoryId);
export const useRetryFailedFramesMutation = createInvalidatingMutation<RetryFailedFramesResponse, RetryFailedFramesParams>(
    service.retryFailedFrames,
    [analysisQuery.QUERY_KEYS.lists(), KEYS.byTrajectory()]
);
