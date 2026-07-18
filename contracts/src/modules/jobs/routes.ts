import { post, del } from '../../shared/routing';
import type {
    RemoveTeamRunningJobsResponse,
    RetryTeamFailedJobsResponse
} from './domain';

export const jobsRoutes = {
    removeRunningJobs: del<RemoveTeamRunningJobsResponse>('/api/jobs/:teamId/:trajectoryId/running'),
    retryFailedJobs: post<never, RetryTeamFailedJobsResponse>('/api/jobs/:teamId/:trajectoryId/failed/retries')
} as const;
