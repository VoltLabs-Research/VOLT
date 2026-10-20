import { createService, del, post } from '@/app/core/http/utils/create-service';
import type {
    RemoveTeamRunningJobsResponse,
    RetryTeamFailedJobsResponse
} from '@volt/contracts/modules/jobs/domain';

export interface TrajectoryJobsParams {
    trajectoryId: string;
}

const endpoints = {
    removeRunningJobs: del<TrajectoryJobsParams, RemoveTeamRunningJobsResponse>('/jobs', {
        unwrap: 'data'
    }),
    retryFailedJobs: post<TrajectoryJobsParams, RetryTeamFailedJobsResponse>('/jobs/retries')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
