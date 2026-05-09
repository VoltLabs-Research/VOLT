import { createService, paginated, get, post, del } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Analysis } from './entities/analysis';

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

export interface RetryFailedFramesResponse {
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
}

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

export default createService({
    clients: {
        default: {
            basePath: '/analyses',
            useRBAC: true
        }
    }
}, endpoints);
