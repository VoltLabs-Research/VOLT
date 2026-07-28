
import type { TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';
import { createService, del, post } from '@/app/core/http/utils/create-service';
import type { TeamClusterFailureDetail } from '@volt/contracts/modules/jobs/domain';

export interface RemoveRunningJobsParams {
    trajectoryId: string;
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
