import { createService, paginated, get, post, del } from '@/app/core/http/utils/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { RetryFailedFramesResponse } from '@volt/contracts/modules/analysis/domain';

export interface GetAnalysesByTrajectoryParams {
    trajectoryId: string;
    page: number;
    limit: number;
}

export interface GetAnalysesParams {
    page: number;
    limit: number;
    search?: string;
}

export type AnalysisLogStream = 'stdout' | 'stderr' | 'system';
export type AnalysisFrameLogStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalysisLogSegment {
    stream: AnalysisLogStream;
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
}

export interface GetAnalysisFrameLogParams {
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

export interface GetAnalysisFrameLogResponse {
    analysisId: string;
    timestep: number;
    status: AnalysisFrameLogStatus;
    sealed: boolean;
    truncated: boolean;
    nextCursor: string | null;
    segments: AnalysisLogSegment[];
}

export interface RetryFailedFramesParams {
    analysisId: string;
}

interface DeleteAnalysisParams {
    analysisId: string;
};

const endpoints = {
    getAll: paginated<GetAnalysesParams, PaginatedResponse<Analysis>>('/analyses'),
    getByTrajectoryId: paginated<GetAnalysesByTrajectoryParams, PaginatedResponse<Analysis>>('/analyses'),
    delete: del<DeleteAnalysisParams>('/analyses/:analysisId'),
    retryFailedFrames: post<RetryFailedFramesParams, RetryFailedFramesResponse>('/analyses/:analysisId/failed-frames/retries'),
    getFrameLog: get<GetAnalysisFrameLogParams, GetAnalysisFrameLogResponse>('/analyses/:analysisId/logs/:timestep')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
