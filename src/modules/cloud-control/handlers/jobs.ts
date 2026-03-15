import { createJobControlService } from '@/modules/job-runtime/services';
import type { ClearJobsHistoryRequest, RemoveRunningJobsRequest, RetryJobsRequest } from '@/shared/contracts';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { ReverseChannelCommandHandler } from '../services';
import { readPayloadRecord, readRecord, readString, readStringArray } from './payloadValidation';

interface JobHandlersDependencies {
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
};

interface QueueDispatchRequest {
    queueName: string;
    payload: Record<string, unknown>;
};

interface JobsListRequest {
    teamId: string;
};

const readQueueDispatchRequest = (payload: unknown): QueueDispatchRequest => {
    const record = readPayloadRecord(payload);

    return {
        queueName: readString(record.queueName, 'queueName'),
        payload: readRecord(record.payload, 'payload')
    };
};

const readJobsListRequest = (payload: unknown): JobsListRequest => {
    const record = readPayloadRecord(payload);

    return {
        teamId: readString(record.teamId, 'teamId')
    };
};

const readRetryJobsRequest = (payload: unknown): RetryJobsRequest => {
    const record = readPayloadRecord(payload);

    return {
        jobIds: readStringArray(record.jobIds, 'jobIds')
    };
};

const readRemoveRunningJobsRequest = (payload: unknown): RemoveRunningJobsRequest => {
    const record = readPayloadRecord(payload);

    return {
        jobIds: readStringArray(record.jobIds, 'jobIds')
    };
};

const readClearJobsHistoryRequest = (payload: unknown): ClearJobsHistoryRequest => {
    const record = readPayloadRecord(payload);

    return {
        teamId: readString(record.teamId, 'teamId'),
        jobIds: readStringArray(record.jobIds, 'jobIds')
    };
};

export const createJobHandlers = (deps: JobHandlersDependencies): ReverseChannelCommandHandler[] => {
    const jobControlService = createJobControlService(deps.queueService, deps.redisConnectionService);

    return [
        {
            command: 'queue.dispatch',
            execute: async (payload) => {
                const request = readQueueDispatchRequest(payload);
                await deps.queueService.enqueue(request.queueName, request.payload);
                return { data: { queued: true } };
            }
        },
        {
            command: 'jobs.list',
            execute: async (payload) => {
                const request = readJobsListRequest(payload);
                const jobs = await deps.redisConnectionService.getTeamJobs(request.teamId);
                return {
                    data: {
                        data: jobs
                    }
                };
            }
        },
        {
            command: 'jobs.retry',
            execute: async (payload) => ({
                data: await jobControlService.retryJobs(readRetryJobsRequest(payload))
            })
        },
        {
            command: 'jobs.remove-running',
            execute: async (payload) => ({
                data: await jobControlService.removeRunningJobs(readRemoveRunningJobsRequest(payload))
            })
        },
        {
            command: 'jobs.clear-history',
            execute: async (payload) => ({
                data: await jobControlService.clearJobsHistory(readClearJobsHistoryRequest(payload))
            })
        }
    ];
};
