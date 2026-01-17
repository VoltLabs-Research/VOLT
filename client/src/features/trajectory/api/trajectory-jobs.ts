import VoltClient from '@/api';
import type {
    ClearHistoryResponse,
    RemoveRunningJobsResponse,
    RetryFailedJobsResponse
} from '@/types/api/trajectory-jobs';

const client = new VoltClient('/trajectory-jobs', { useRBAC: true });

export default {
    /**
     * Clear all job history for a trajectory
     * Removes all jobs from Redis and deletes active analyses
     */
    async clearHistory(trajectoryId: string): Promise<ClearHistoryResponse> {
        const response = await client.request('patch', `/${trajectoryId}/jobs/clear-history`);
        return response.data.data;
    },

    /**
     * Remove only running/queued jobs for a trajectory
     * Removes running jobs from Redis and deletes their analyses
     */
    async removeRunningJobs(trajectoryId: string): Promise<RemoveRunningJobsResponse> {
        const response = await client.request('patch', `/${trajectoryId}/jobs/remove-running`);
        return response.data.data;
    },

    /**
     * Retry all failed jobs for a trajectory
     * Finds all analyses and retries failed frames
     */
    async retryFailedJobs(trajectoryId: string): Promise<RetryFailedJobsResponse> {
        const response = await client.request('patch', `/${trajectoryId}/jobs/retry-failed`);
        return response.data.data;
    }
};
