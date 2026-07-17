
import type { TrajectoryJobGroup } from './types/job';
import { createService, del, post } from '@/app/core/http/utilities/create-service';

export interface RemoveRunningJobsParams {
    trajectoryId: string;
}

export interface TeamClusterFailureDetail {
    teamClusterId: string;
    requestedJobs: number;
    affectedJobs: number;
    reason: 'command-failed' | 'partial-confirmation';
    message?: string;
}

export interface RemoveRunningJobsResponse {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
    revision: number;
    groups: TrajectoryJobGroup[];
}

export interface RetryFailedJobsParams {
    trajectoryId: string;
}

export interface RetryFailedJobsResponse {
    retriedFrames: number;
}

const endpoints = {
    removeRunningJobs: del<RemoveRunningJobsParams, RemoveRunningJobsResponse>('/:trajectoryId/running', {
        unwrap: 'data'
    }),
    retryFailedJobs: post<RetryFailedJobsParams, RetryFailedJobsResponse>('/:trajectoryId/failed/retries')
};

export default createService({
    clients: {
        default: {
            basePath: '/jobs',
            useRBAC: true
        }
    }
}, endpoints);
