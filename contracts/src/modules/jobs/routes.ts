import { post, del } from '../../shared/routing';
import type {
    RemoveTeamRunningJobsResponse,
    RetryTeamFailedJobsResponse
} from './domain';
import type { RetryTeamFailedJobsInput } from './http';

export const jobsRoutes = {
    removeRunningJobs: del<RemoveTeamRunningJobsResponse>('/api/teams/:teamId/jobs'),
    retryFailedJobs: post<RetryTeamFailedJobsInput, RetryTeamFailedJobsResponse>('/api/teams/:teamId/jobs/retries')
} as const;
