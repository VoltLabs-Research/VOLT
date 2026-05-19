import { Factory } from '@/core/decorators/service';
import type { QueueService } from '@/core/queues/application/QueueService';
import { stopProcess } from '@/core/runtime/infrastructure/process-tracker';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import type {
    JobsActionResponse,
    RemoveRunningJobsRequest,
    RetryJobsRequest
} from '@/modules/analysis/contracts/http-analysis';

const REMOVED_ANALYSIS_JOB_TOMBSTONE_PREFIX = 'analysis:removed-job:';
const REMOVED_ANALYSIS_JOB_TOMBSTONE_TTL_SECONDS = 86_400;

export class JobControl {
    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnection: RedisConnection
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

        return { affectedJobs: affectedJobIds.length, affectedJobIds };
    };

    removeRunningJobs = async (input: RemoveRunningJobsRequest): Promise<JobsActionResponse> => {
        const affectedJobIds: string[] = [];

        for (const jobId of input.jobIds) {
            await this.redisConnection.setValueWithTtl(
                `${REMOVED_ANALYSIS_JOB_TOMBSTONE_PREFIX}${jobId}`,
                '1',
                REMOVED_ANALYSIS_JOB_TOMBSTONE_TTL_SECONDS
            );
            stopProcess(jobId);
            await this.queueService.removeJobById(jobId).catch(() => false);
            affectedJobIds.push(jobId);
        }

        return { affectedJobs: affectedJobIds.length, affectedJobIds };
    };
}

export const createJobControlService = Factory('jobControl')((
    queueService: QueueService,
    redisConnection: RedisConnection
): JobControl => {
    return new JobControl(queueService, redisConnection);
});
