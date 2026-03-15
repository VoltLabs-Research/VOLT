import type { JobsActionResponse, RetryJobsRequest, RemoveRunningJobsRequest, ClearJobsHistoryRequest } from '@/shared/contracts';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import { stopProcess } from './processTracker';

interface RetryableJobRecord extends Record<string, unknown> {
    jobId: string;
    teamId: string;
    queueType: string;
};

const isRetryableJobRecord = (value: Record<string, unknown> | null): value is RetryableJobRecord => {
    return value !== null
        && typeof value.jobId === 'string'
        && typeof value.teamId === 'string'
        && typeof value.queueType === 'string';
};

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
            const projectedJob = await redisConnectionService.getJobRecord(jobId);
            if (!projectedJob || !isRetryableJobRecord(projectedJob)) {
                continue;
            }

            const queueName = projectedJob.queueType;
            const payload = await queueService.getJobPayload(queueName, jobId) || projectedJob;

            const retried = await queueService.retryJob(queueName, jobId);
            if (!retried) {
                await queueService.enqueue(queueName, {
                    ...payload,
                    status: 'queued',
                    updatedAt: new Date().toISOString(),
                    error: undefined
                });
            }

            await redisConnectionService.projectJobStatus({
                ...payload,
                jobId,
                teamId: String(payload.teamId || projectedJob.teamId),
                queueType: queueName,
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
            const projectedJob = await redisConnectionService.getJobRecord(jobId);
            const queueName = projectedJob?.queueType;
            const stopped = stopProcess(jobId);
            const removed = queueName
                ? await queueService.removeJob(queueName, jobId).catch(() => false)
                : false;

            if (!stopped && !removed) {
                continue;
            }

            if (projectedJob?.teamId) {
                await redisConnectionService.removeJobs(projectedJob.teamId, [jobId]);
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
