import { createJobControlService } from '@/modules/jobs/application/control/JobControlService';
import { ANALYSIS_QUEUE_NAME, SSH_IMPORT_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { ChannelCommands } from '@/core/reverse-channel/contracts/reverseChannel.constants';
import { inflateAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import type { AnalysisQueueJobPayload, AnalysisJobExecutionData, ClearJobsHistoryRequest, RemoveRunningJobsRequest, RetryJobsRequest } from '@/contracts';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';
import type { ReverseChannelCommandHandler } from '@/core/reverse-channel/contracts/commandHandler';

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

const DISPATCHABLE_QUEUE_NAMES = new Set<string>([
    ANALYSIS_QUEUE_NAME,
    SSH_IMPORT_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME
]);

const readCompressedAnalysisExecutionData = (value: unknown): AnalysisJobExecutionData => {
    return inflateAnalysisExecutionData(value as string);
};

const normalizeQueuePayload = (queueName: string, payload: Record<string, unknown>): Record<string, unknown> => {
    if (queueName === ANALYSIS_QUEUE_NAME) {
        return normalizeAnalysisQueuePayload(payload);
    }

    return payload;
};

const normalizeAnalysisQueuePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
    const executionDataCompressed = payload.executionDataCompressed;
    const normalizedPayload = {
        ...payload,
        metadata: (payload.metadata as Record<string, unknown> | undefined) ?? {}
    } as AnalysisQueueJobPayload;

    if (typeof executionDataCompressed === 'string' && !normalizedPayload.executionData) {
        normalizedPayload.executionData = readCompressedAnalysisExecutionData(executionDataCompressed);
    }

    return normalizedPayload;
};

export const createJobHandlers = (deps: JobHandlersDependencies): ReverseChannelCommandHandler[] => {
    const jobControlService = createJobControlService(deps.queueService);

    return [
        {
            command: ChannelCommands.QueueDispatch,
            execute: async (payload) => {
                const request = payload as unknown as QueueDispatchRequest;
                if (!DISPATCHABLE_QUEUE_NAMES.has(request.queueName)) {
                    throw new Error(`Unsupported queue dispatch target: ${request.queueName}`);
                }

                const queuePayload = normalizeQueuePayload(request.queueName, request.payload);

                await deps.queueService.enqueue(request.queueName, queuePayload);
                return { data: { queued: true } };
            }
        },
        {
            command: ChannelCommands.JobsList,
            execute: async (payload) => {
                const request = payload as unknown as JobsListRequest;
                const jobs = await deps.redisConnectionService.getTeamJobs(request.teamId);
                return {
                    data: {
                        data: jobs
                    }
                };
            }
        },
        {
            command: ChannelCommands.JobsRetry,
            execute: async (payload) => ({
                data: await jobControlService.retryJobs(payload as unknown as RetryJobsRequest)
            })
        },
        {
            command: ChannelCommands.JobsRemoveRunning,
            execute: async (payload) => ({
                data: await jobControlService.removeRunningJobs(payload as unknown as RemoveRunningJobsRequest)
            })
        },
        {
            command: ChannelCommands.JobsClearHistory,
            execute: async (payload) => ({
                data: await jobControlService.clearJobsHistory(payload as unknown as ClearJobsHistoryRequest)
            })
        }
    ];
};
