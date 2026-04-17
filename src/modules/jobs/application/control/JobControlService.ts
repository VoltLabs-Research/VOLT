import type { QueueService } from '@/core/queues/application/QueueService';
import { stopProcess } from '@/core/runtime/infrastructure/processTracker';
import type {
    ClearJobsHistoryRequest,
    JobsActionResponse,
    RemoveRunningJobsRequest,
    RetryJobsRequest
} from '@/modules/analysis/contracts/http.analysis';

export class JobControlService {
    constructor(private readonly queueService: QueueService) {}

    retryJobs = async (input: RetryJobsRequest): Promise<JobsActionResponse> => {
        let affectedJobs = 0;

        for (const jobId of input.jobIds) {
            const retried = await this.queueService.retryJobById(jobId);
            if (!retried) {
                continue;
            }
            affectedJobs += 1;
        }

        return { affectedJobs };
    };

    removeRunningJobs = async (input: RemoveRunningJobsRequest): Promise<JobsActionResponse> => {
        let affectedJobs = 0;

        for (const jobId of input.jobIds) {
            const stopped = stopProcess(jobId);
            const removed = await this.queueService.removeJobById(jobId).catch(() => false);

            if (!stopped && !removed) {
                continue;
            }

            affectedJobs += 1;
        }

        return { affectedJobs };
    };

    clearJobsHistory = (_input: ClearJobsHistoryRequest): Promise<JobsActionResponse> => {
        return { affectedJobs: 0 };
    };
}

export const createJobControlService = (queueService: QueueService): JobControlService => {
    return new JobControlService(queueService);
};
