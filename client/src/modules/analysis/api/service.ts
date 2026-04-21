import { paginated, get, post, del } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Analysis } from './entities/analysis';
import type { GetAnalysesParams } from './dtos/get-analyses';
import type { GetAnalysesByTrajectoryParams } from './dtos/get-analyses-by-trajectory';
import type {
    GetAnalysisFrameLogParams,
    GetAnalysisFrameLogResponse
} from './dtos/get-analysis-frame-log';
import type { RetryFailedFramesParams, RetryFailedFramesResponse } from './dtos/retry-failed-frames';

interface DeleteAnalysisParams {
    analysisId: string;
};

const endpoints = {
    getAll: paginated<GetAnalysesParams, PaginatedResponse<Analysis>>('/'),
    getByTrajectoryId: paginated<GetAnalysesByTrajectoryParams, PaginatedResponse<Analysis>>(
        '/trajectory/:trajectoryId'
    ),
    delete: del<DeleteAnalysisParams>('/:analysisId'),
    retryFailedFrames: post<RetryFailedFramesParams, RetryFailedFramesResponse>('/:analysisId/failed-frames/retries'),
    getFrameLog: get<GetAnalysisFrameLogParams, GetAnalysisFrameLogResponse>('/:analysisId/logs/:timestep')
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/analyses',
            useRBAC: true
        }
    },
    endpoints
});
