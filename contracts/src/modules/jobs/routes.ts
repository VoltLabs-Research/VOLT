import { post, del } from '../../shared/routing';
import type {
    RemoveTeamRunningJobsResponse,
    RetryTeamFailedJobsResponse
} from './domain';

/**
 * Every client-facing jobs endpoint, typed by response. All paths are the full
 * wire paths (team-scoped under `/api/jobs/:teamId`), matching the previous
 * `createHttpModule({ basePath: '/api/jobs/:teamId', resource: Resource.TRAJECTORY })`
 * routing verbatim — the guard resource is TRAJECTORY, not a jobs resource.
 */
export const jobsRoutes = {
    removeRunningJobs: del<RemoveTeamRunningJobsResponse>('/api/jobs/:teamId/:trajectoryId/running'),
    retryFailedJobs: post<never, RetryTeamFailedJobsResponse>('/api/jobs/:teamId/:trajectoryId/failed/retries')
} as const;
