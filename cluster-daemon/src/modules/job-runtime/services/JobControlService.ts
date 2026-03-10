import type { JobsActionResponse, RetryJobsRequest, RemoveRunningJobsRequest, ClearJobsHistoryRequest } from '../../../shared/contracts';
import type { QueueService, RedisConnectionService } from '../../platform/services';
import { stopProcess } from './processTracker';

const ANALYSIS_QUEUE_NAME = 'analysis_processing';

export interface JobControlService {
    retryJobs(input: RetryJobsRequest): Promise<JobsActionResponse>;
    removeRunningJobs(input: RemoveRunningJobsRequest): Promise<JobsActionResponse>;
    clearJobsHistory(input: ClearJobsHistoryRequest): Promise<JobsActionResponse>;
}

export const createJobControlService = (
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): JobControlService => ({
    async retryJobs(input) {
        let affectedJobs = 0;

        for (const jobId of input.jobIds) {
            const payload = await queueService.getJobPayload(ANALYSIS_QUEUE_NAME, jobId);
            if (!payload) {
                continue;
            }

            const retried = await queueService.retryJob(ANALYSIS_QUEUE_NAME, jobId);
            if (!retried) {
                await queueService.enqueue(ANALYSIS_QUEUE_NAME, {
                    ...payload,
                    status: 'queued',
                    updatedAt: new Date().toISOString(),
                    error: undefined
                });
            }

            await redisConnectionService.projectJobStatus({
                ...payload,
                jobId,
                teamId: String(payload.teamId || ''),
                queueType: ANALYSIS_QUEUE_NAME,
                status: 'queued',
                error: undefined,
                updatedAt: new Date().toISOString()
            });
            affectedJobs += 1;
        }

        return { affectedJobs };
    },

    async removeRunningJobs(input) {
        let affectedJobs = 0;

        for (const jobId of input.jobIds) {
            const stopped = stopProcess(jobId);
            const removed = await queueService.removeJob(ANALYSIS_QUEUE_NAME, jobId).catch(() => false);

            if (!stopped && !removed) {
                continue;
            }

            affectedJobs += 1;
        }

        return { affectedJobs };
    },

    async clearJobsHistory(input) {
        const affectedJobs = input.jobIds.length > 0
            ? await redisConnectionService.removeJobs(input.teamId, input.jobIds)
            : await redisConnectionService.clearTeamJobs(input.teamId);

        return { affectedJobs };
    }
});
