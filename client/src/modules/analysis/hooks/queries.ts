import { buildKeys, createMutation, createQuery, createPaginatedQuery } from '@/shared/infrastructure/query/create-paginated-query';
import { patchPaginatedPage, removeEntityFromList } from '@/shared/infrastructure/query/cache-utils';
import { patchTrajectoryDetailCaches } from '@/modules/trajectory/hooks/trajectory/queries';
import service from '../api/service';
import type { Analysis } from '../api/entities/analysis';
import type { GetAnalysesParams } from '../api/dtos/get-analyses';
import type { GetAnalysesByTrajectoryParams } from '../api/dtos/get-analyses-by-trajectory';
import type { RetryFailedFramesResponse } from '../api/dtos/retry-failed-frames';

const BASE_KEY = 'analysis';

export const KEYS = buildKeys<{
    detail: string;
    byTrajectory: GetAnalysesByTrajectoryParams;
}>(BASE_KEY);

export const analysisQuery = createPaginatedQuery<Analysis, GetAnalysesParams>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    service: {
        list: service.getAll,
        delete: (id) => service.delete({ _id: id })
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
export const useRetryFailedFramesMutation = createMutation<RetryFailedFramesResponse, { _id: string }>(
    service.retryFailedFrames
);