import { Factory } from '@/core/decorators/service';
import type { QueueService } from '@/core/queues/application/QueueService';
import { stopProcess } from '@/core/runtime/infrastructure/process-tracker';
import type {
    JobsActionResponse,
    RemoveRunningJobsRequest,
    RetryJobsRequest
} from '@/modules/analysis/contracts/http-analysis';

export class JobControl {
    constructor(private readonly queueService: QueueService) {}

    retryJobs = async (input: RetryJobsRequest): Promise<JobsActionResponse> => {
        const affectedJobIds: string[] = [];

        for (const jobId of input.jobIds) {
            const retried = await this.queueService.retryJobById(jobId);
            if (!retried) {
                continue;
            }
            affectedJobIds.push(jobId);
        }

        return { affectedJobs: affectedJobIds.length, affectedJobIds };
    };

    removeRunningJobs = async (input: RemoveRunningJobsRequest): Promise<JobsActionResponse> => {
        const affectedJobIds: string[] = [];

        for (const jobId of input.jobIds) {
            const stopped = stopProcess(jobId);
            const removed = await this.queueService.removeJobById(jobId).catch(() => false);

            if (!stopped && !removed) {
                continue;
            }

            affectedJobIds.push(jobId);
        }

        return { affectedJobs: affectedJobIds.length, affectedJobIds };
    };
}

export const createJobControlService = Factory('jobControl')((queueService: QueueService): JobControl => {
    return new JobControl(queueService);
});
