import type { QueueService } from '@/core/queues/application/QueueService';
import type { JobsActionResponse, RetryJobsRequest, RemoveRunningJobsRequest, ClearJobsHistoryRequest } from '@/contracts';
import { stopProcess } from '@/core/runtime/infrastructure/processTracker';

export interface JobControlService {
    retryJobs(input: RetryJobsRequest): Promise<JobsActionResponse>;
    removeRunningJobs(input: RemoveRunningJobsRequest): Promise<JobsActionResponse>;
    clearJobsHistory(input: ClearJobsHistoryRequest): Promise<JobsActionResponse>;
}

export const createJobControlService = (
    queueService: QueueService
): JobControlService => ({
    async retryJobs(input) {
        let affectedJobs = 0;

        for (const jobId of input.jobIds) {
            const retried = await queueService.retryJobById(jobId);
            if (!retried) {
                continue;
            }
            affectedJobs += 1;
        }

        return { affectedJobs };
    },

    async removeRunningJobs(input) {
        let affectedJobs = 0;

        for (const jobId of input.jobIds) {
            const stopped = stopProcess(jobId);
            const removed = await queueService.removeJobById(jobId).catch(() => false);

            if (!stopped && !removed) {
                continue;
            }

            affectedJobs += 1;
        }

        return { affectedJobs };
    },

    async clearJobsHistory(input) {
        return { affectedJobs: 0 };
    }
});
