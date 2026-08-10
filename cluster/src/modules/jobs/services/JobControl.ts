import { singleton } from '@shared/application/utilities/singleton';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getDaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import { stopProcess } from '@shared/infrastructure/runtime/process-tracker';
import type { DaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import type {
    JobsActionResponse,
    RemoveRunningJobsRequest,
    RetryJobsRequest
} from '@shared/contracts/types/http-analysis';

const REMOVED_ANALYSIS_JOB_TOMBSTONE_PREFIX = 'analysis:removed-job:';
const REMOVED_ANALYSIS_JOB_TOMBSTONE_TTL_SECONDS = 86_400;

export class JobControl {
    constructor(
        private readonly queueService: QueueService,
        private readonly stateStore: DaemonStateStore
    ) {}

    retryJobs = async (input: RetryJobsRequest): Promise<JobsActionResponse> => {
        const affectedJobIds: string[] = [];

        for (const jobId of input.jobIds) {
            const retried = await this.queueService.retryJobById(jobId);
            if (!retried) {
                continue;
            }
            affectedJobIds.push(jobId);
        }

        return {
            affectedJobs: affectedJobIds.length,
            affectedJobIds
        };
    };

    removeRunningJobs = async (input: RemoveRunningJobsRequest): Promise<JobsActionResponse> => {
        const affectedJobIds: string[] = [];

        for (const jobId of input.jobIds) {
            await this.stateStore.setValueWithTtl(
                `${REMOVED_ANALYSIS_JOB_TOMBSTONE_PREFIX}${jobId}`,
                '1',
                REMOVED_ANALYSIS_JOB_TOMBSTONE_TTL_SECONDS
            );
            stopProcess(jobId);
            await this.queueService.removeJobById(jobId).catch(() => false);
            affectedJobIds.push(jobId);
        }

        return {
            affectedJobs: affectedJobIds.length,
            affectedJobIds
        };
    };
}

export const getJobControl = singleton((): JobControl => new JobControl(getQueueService(), getDaemonStateStore()));
