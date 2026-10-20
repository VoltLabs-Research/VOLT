import { post, del } from '../../shared/routing';
import type {
    RemoveTeamRunningJobsResponse,
    RetryTeamJobsResult
} from './domain';
import type { RetryTeamFailedJobsInput } from './http';

export const jobsRoutes = {
    removeRunningJobs: del<RemoveTeamRunningJobsResponse>('/api/teams/:teamId/jobs'),
    retryFailedJobs: post<RetryTeamFailedJobsInput, RetryTeamJobsResult>('/api/teams/:teamId/jobs/retries')
} as const;
