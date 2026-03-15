import type { QueueService, RedisConnectionService, TeamJobRecord } from '@/modules/platform/services';
import type { JobsActionResponse, RetryJobsRequest, RemoveRunningJobsRequest, ClearJobsHistoryRequest } from '@/shared/contracts';
import { stopProcess } from './processTracker';

const isDaemonControllableJob = (jobRecord: TeamJobRecord): boolean => {
    const source = typeof jobRecord.source === 'string'
        ? jobRecord.source
        : undefined;
    const jobClassification = typeof jobRecord.jobClassification === 'string'
        ? jobRecord.jobClassification
        : undefined;
    const daemonBacked = typeof jobRecord.daemonBacked === 'boolean'
        ? jobRecord.daemonBacked
        : undefined;
    const retriable = typeof jobRecord.retriable === 'boolean'
        ? jobRecord.retriable
        : undefined;

    if (source === 'projected' && jobClassification === 'synthetic') {
        return false;
    }

    if (daemonBacked === false || retriable === false) {
        return false;
    }

    return true;
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
            if (!projectedJob || !isDaemonControllableJob(projectedJob)) {
                continue;
            }

            const queueName = projectedJob.queueType;
            const retried = await queueService.retryJob(queueName, jobId);
            if (!retried) {
                continue;
            }

            const updatedAt = new Date().toISOString();

            await redisConnectionService.projectJobStatus({
                ...projectedJob,
                jobId,
                queueType: queueName,
                status: 'queued',
                error: undefined,
                updatedAt
            });
            affectedJobs += 1;
        }

        return { affectedJobs };
    },

    async removeRunningJobs(input) {
        let affectedJobs = 0;

        for (const jobId of input.jobIds) {
            const projectedJob = await redisConnectionService.getJobRecord(jobId);
            if (!projectedJob || !isDaemonControllableJob(projectedJob)) {
                continue;
            }

            const queueName = projectedJob.queueType;
            const stopped = stopProcess(jobId);
            const removed = await queueService.removeJob(queueName, jobId).catch(() => false);

            if (!stopped && !removed) {
                continue;
            }

            affectedJobs += await redisConnectionService.removeJobs(projectedJob.teamId, [jobId]);
        }

        return { affectedJobs };
    },

    async clearJobsHistory(input) {
        if (input.jobIds.length === 0) {
            const affectedJobs = await redisConnectionService.clearTeamJobs(input.teamId);

            return { affectedJobs };
        }

        const daemonOwnedJobIds: string[] = [];

        for (const jobId of input.jobIds) {
            const projectedJob = await redisConnectionService.getJobRecord(jobId);

            if (!projectedJob || projectedJob.teamId !== input.teamId) {
                continue;
            }

            daemonOwnedJobIds.push(jobId);
        }

        const affectedJobs = daemonOwnedJobIds.length > 0
            ? await redisConnectionService.removeJobs(input.teamId, daemonOwnedJobIds)
            : 0;

        return { affectedJobs };
    }
});
