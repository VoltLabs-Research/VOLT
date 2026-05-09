
import { createService, del, post } from '@/app/core/http/utilities/create-service';

export interface RemoveRunningJobsParams {
    trajectoryId: string;
}

export interface RemoveRunningJobsOutputDTO {
    deletedJobs: number;
    deletedAnalyses: number;
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
