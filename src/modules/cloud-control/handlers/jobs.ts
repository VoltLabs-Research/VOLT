import { createJobControlService } from '@/modules/job-runtime/services';
import {
    ANALYSIS_QUEUE_NAME,
    SSH_IMPORT_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME
} from '@/modules/platform/services';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts/reverseChannel';
import {
    inflateAnalysisExecutionData,
    isAnalysisExecutionDataReference,
    isAnalysisJobExecutionData
} from '@/shared/utilities/analysis-execution-data';
import type {
    AnalysisQueueJobPayload,
    AnalysisJobExecutionData,
    ClearJobsHistoryRequest,
    RemoveRunningJobsRequest,
    RetryJobsRequest
} from '@/shared/contracts';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { ReverseChannelCommandHandler } from '../services';

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
    const compressedValue = value as string;

    try {
        return inflateAnalysisExecutionData(compressedValue);
    } catch (error: unknown) {
        const message = error instanceof Error
            ? error.message
            : 'Unknown compressed execution data error';
        throw new Error(`payload.executionDataCompressed is invalid: ${message}`);
    }
};

const normalizeQueuePayload = (queueName: string, payload: Record<string, unknown>): Record<string, unknown> => {
    if (queueName === ANALYSIS_QUEUE_NAME) {
        return normalizeAnalysisQueuePayload(payload);
    }

    return payload;
};

const normalizeAnalysisQueuePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
    const metadata = (payload.metadata as Record<string, unknown> | undefined) ?? {};
    const inlineExecutionData = payload.executionData;
    const executionDataReference = payload.executionDataReference;
    const executionDataCompressed = payload.executionDataCompressed;
    const normalizedPayload: AnalysisQueueJobPayload = {
        ...payload,
        metadata
    };

    delete normalizedPayload.executionData;
    delete normalizedPayload.executionDataCompressed;
    delete normalizedPayload.executionDataReference;

    if (isAnalysisJobExecutionData(inlineExecutionData)) {
        normalizedPayload.executionData = inlineExecutionData;
        return normalizedPayload;
    }

    if (isAnalysisExecutionDataReference(executionDataReference)) {
        normalizedPayload.executionDataReference = executionDataReference;

        if (typeof executionDataCompressed === 'string' && executionDataCompressed.length > 0) {
            normalizedPayload.executionDataCompressed = executionDataCompressed;
            normalizedPayload.executionData = readCompressedAnalysisExecutionData(executionDataCompressed);
        }

        return normalizedPayload;
    }

    return payload;
};

export const createJobHandlers = (deps: JobHandlersDependencies): ReverseChannelCommandHandler[] => {
    const jobControlService = createJobControlService(deps.queueService);

    return [
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.queue.dispatch,
            execute: async (payload) => {
                const request = payload as QueueDispatchRequest;
                if (!DISPATCHABLE_QUEUE_NAMES.has(request.queueName)) {
                    throw new Error(`Unsupported queue dispatch target: ${request.queueName}`);
                }

                const queuePayload = normalizeQueuePayload(request.queueName, request.payload);

                await deps.queueService.enqueue(request.queueName, queuePayload);
                return { data: { queued: true } };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.jobs.list,
            execute: async (payload) => {
                const request = payload as JobsListRequest;
                const jobs = await deps.redisConnectionService.getTeamJobs(request.teamId);
                return {
                    data: {
                        data: jobs
                    }
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.jobs.retry,
            execute: async (payload) => ({
                data: await jobControlService.retryJobs(payload as RetryJobsRequest)
            })
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.jobs.removeRunning,
            execute: async (payload) => ({
                data: await jobControlService.removeRunningJobs(payload as RemoveRunningJobsRequest)
            })
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.jobs.clearHistory,
            execute: async (payload) => ({
                data: await jobControlService.clearJobsHistory(payload as ClearJobsHistoryRequest)
            })
        }
    ];
};
