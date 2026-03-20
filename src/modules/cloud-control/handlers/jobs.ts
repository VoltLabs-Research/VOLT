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
    AnalysisJobExecutionData,
    ClearJobsHistoryRequest,
    GlbConversionQueueJobPayload,
    RasterQueueJobPayload,
    RemoveRunningJobsRequest,
    RetryJobsRequest
} from '@/shared/contracts';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readNumber,
    readOptionalRecord,
    readPayloadRecord,
    readRecord,
    readString,
    readStringArray
} from './payloadValidation';

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

interface SSHImportQueueJobPayload extends Record<string, unknown> {
    teamId: string;
    sshConnectionId: string;
    remotePath: string;
    userId: string;
    host: string;
    port?: number;
    username: string;
    encryptedPassword: string;
    trajectoryId: string;
    trajectoryName: string;
};

const DISPATCHABLE_QUEUE_NAMES = new Set<string>([
    ANALYSIS_QUEUE_NAME,
    SSH_IMPORT_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME
]);

const readQueueDispatchRequest = (payload: unknown): QueueDispatchRequest => {
    const record = readPayloadRecord(payload);

    return {
        queueName: readString(record.queueName, 'queueName'),
        payload: readRecord(record.payload, 'payload')
    };
};

const readCompressedAnalysisExecutionData = (value: unknown): AnalysisJobExecutionData => {
    const compressedValue = readString(value, 'payload.executionDataCompressed');

    try {
        return inflateAnalysisExecutionData(compressedValue);
    } catch (error: unknown) {
        const message = error instanceof Error
            ? error.message
            : 'Unknown compressed execution data error';
        throw new Error(`payload.executionDataCompressed is invalid: ${message}`);
    }
};

const readOptionalPayloadString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    return value;
};

const readQueueType = (value: unknown, expectedQueueName: string): string => {
    const queueType = readString(value, 'payload.queueType');

    if (queueType !== expectedQueueName) {
        throw new Error(`payload.queueType must be ${expectedQueueName}`);
    }

    return queueType;
};

const normalizeRasterQueuePayload = (payload: Record<string, unknown>): RasterQueueJobPayload => {
    const metadata = readOptionalRecord(payload.metadata);
    const error = readOptionalPayloadString(payload.error);
    const trajectoryName = readOptionalPayloadString(payload.trajectoryName);

    return {
        ...payload,
        jobId: readString(payload.jobId, 'payload.jobId'),
        teamId: readString(payload.teamId, 'payload.teamId'),
        trajectoryId: readString(payload.trajectoryId, 'payload.trajectoryId'),
        trajectoryName,
        timestep: readNumber(payload.timestep, 'payload.timestep'),
        modelObjectKey: readString(payload.modelObjectKey, 'payload.modelObjectKey'),
        outputObjectKey: readString(payload.outputObjectKey, 'payload.outputObjectKey'),
        status: readString(payload.status, 'payload.status'),
        queueType: readQueueType(payload.queueType, TRAJECTORY_RASTER_QUEUE_NAME),
        metadata,
        error,
        createdAt: readString(payload.createdAt, 'payload.createdAt'),
        updatedAt: readString(payload.updatedAt, 'payload.updatedAt')
    };
};

const normalizeGlbQueuePayload = (payload: Record<string, unknown>): GlbConversionQueueJobPayload => {
    const metadata = readOptionalRecord(payload.metadata);
    const error = readOptionalPayloadString(payload.error);
    const trajectoryName = readOptionalPayloadString(payload.trajectoryName);

    return {
        ...payload,
        jobId: readString(payload.jobId, 'payload.jobId'),
        teamId: readString(payload.teamId, 'payload.teamId'),
        trajectoryId: readString(payload.trajectoryId, 'payload.trajectoryId'),
        trajectoryName,
        timestep: readNumber(payload.timestep, 'payload.timestep'),
        objectKey: readString(payload.objectKey, 'payload.objectKey'),
        status: readString(payload.status, 'payload.status'),
        queueType: readQueueType(payload.queueType, TRAJECTORY_GLB_QUEUE_NAME),
        metadata,
        error,
        createdAt: readString(payload.createdAt, 'payload.createdAt'),
        updatedAt: readString(payload.updatedAt, 'payload.updatedAt')
    };
};

const normalizeSshImportQueuePayload = (payload: Record<string, unknown>): SSHImportQueueJobPayload => {
    const portValue = payload.port;
    const port = typeof portValue === 'undefined'
        ? undefined
        : readNumber(portValue, 'payload.port');

    return {
        ...payload,
        teamId: readString(payload.teamId, 'payload.teamId'),
        sshConnectionId: readString(payload.sshConnectionId, 'payload.sshConnectionId'),
        remotePath: readString(payload.remotePath, 'payload.remotePath'),
        userId: readString(payload.userId, 'payload.userId'),
        host: readString(payload.host, 'payload.host'),
        port,
        username: readString(payload.username, 'payload.username'),
        encryptedPassword: readString(payload.encryptedPassword, 'payload.encryptedPassword'),
        trajectoryId: readString(payload.trajectoryId, 'payload.trajectoryId'),
        trajectoryName: readString(payload.trajectoryName, 'payload.trajectoryName')
    };
};

const normalizeQueuePayload = (queueName: string, payload: Record<string, unknown>): Record<string, unknown> => {
    if (queueName === ANALYSIS_QUEUE_NAME) {
        return normalizeAnalysisQueuePayload(payload);
    }

    if (queueName === TRAJECTORY_RASTER_QUEUE_NAME) {
        return normalizeRasterQueuePayload(payload);
    }

    if (queueName === TRAJECTORY_GLB_QUEUE_NAME) {
        return normalizeGlbQueuePayload(payload);
    }

    if (queueName === SSH_IMPORT_QUEUE_NAME) {
        return normalizeSshImportQueuePayload(payload);
    }

    return payload;
};

const normalizeAnalysisQueuePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
    const metadata = readOptionalRecord(payload.metadata) ?? {};
    const inlineExecutionData = payload.executionData;
    const executionDataReference = payload.executionDataReference;
    const executionDataCompressed = payload.executionDataCompressed;
    let executionData: AnalysisJobExecutionData;
    const normalizedPayload: Record<string, unknown> = {
        ...payload,
        metadata
    };

    delete normalizedPayload.executionData;
    delete normalizedPayload.executionDataCompressed;
    delete normalizedPayload.executionDataReference;

    if (isAnalysisJobExecutionData(inlineExecutionData)) {
        executionData = inlineExecutionData;
    } else if (isAnalysisExecutionDataReference(executionDataReference)) {
        executionData = readCompressedAnalysisExecutionData(executionDataCompressed);
        normalizedPayload.executionDataReference = executionDataReference;

        if (typeof executionDataCompressed === 'string' && executionDataCompressed.length > 0) {
            normalizedPayload.executionDataCompressed = executionDataCompressed;
        }
    } else {
        throw new Error(
            'Analysis queue payload must include executionData or an executionDataReference with executionDataCompressed'
        );
    }

    if (executionData.batchMode !== true) {
        const inputFile = metadata.inputFile;
        if (typeof inputFile !== 'string' || inputFile.trim().length === 0) {
            throw new Error('Analysis queue payload metadata.inputFile is required');
        }
    }

    normalizedPayload.executionData = executionData;

    return normalizedPayload;
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
            command: TEAM_CLUSTER_DAEMON_COMMAND.queue.dispatch,
            execute: async (payload) => {
                const request = readQueueDispatchRequest(payload);
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
            command: TEAM_CLUSTER_DAEMON_COMMAND.jobs.retry,
            execute: async (payload) => ({
                data: await jobControlService.retryJobs(readRetryJobsRequest(payload))
            })
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.jobs.removeRunning,
            execute: async (payload) => ({
                data: await jobControlService.removeRunningJobs(readRemoveRunningJobsRequest(payload))
            })
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.jobs.clearHistory,
            execute: async (payload) => ({
                data: await jobControlService.clearJobsHistory(readClearJobsHistoryRequest(payload))
            })
        }
    ];
};
