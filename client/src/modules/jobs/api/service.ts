
import type { TrajectoryJobGroup } from './entities/job';
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

export interface RemoveRunningJobsOutputDTO {
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

export interface RetryFailedJobsOutputDTO {
    retriedFrames: number;
}

const endpoints = {
    removeRunningJobs: del<RemoveRunningJobsParams, RemoveRunningJobsOutputDTO>('/:trajectoryId/running', {
        unwrap: 'data'
    }),
    retryFailedJobs: post<RetryFailedJobsParams, RetryFailedJobsOutputDTO>('/:trajectoryId/failed/retries')
};

export default createService({
    clients: {
        default: {
            basePath: '/jobs',
            useRBAC: true
        }
    }
}, endpoints);
