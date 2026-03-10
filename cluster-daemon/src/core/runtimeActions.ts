import {
    ObjectBucketName,
    OrchestrationAction,
    TextEncoding,
    type AnalysisStartRequest,
    type AnalysisQueueJobPayload,
    type ClearJobsHistoryRequest,
    type JobsActionResponse,
    type ObjectUploadRequest,
    type PluginSyncRequest,
    type RasterizeTrajectoryRequest,
    type RemoveRunningJobsRequest,
    type RetryJobsRequest,
    type TrajectoryPreprocessRequest
} from '../contracts/http';
import { ProgressStage } from '../contracts/events';
import { RuntimeEventBroker } from '../infrastructure/RuntimeEventBroker';
import { MinioService } from '../infrastructure/minio/MinioService';
import { QueueService } from '../infrastructure/redis/QueueService';
import { RedisConnectionService } from '../infrastructure/redis/RedisConnectionService';
import { RasterizerService } from '../modules/native/RasterizerService';

const ANALYSIS_QUEUE_NAME = 'analysis_processing';
const TRAJECTORY_QUEUE_NAME = 'TrajectoryProcessingQueue';

export const emitProgress = (
    eventBroker: RuntimeEventBroker,
    action: OrchestrationAction,
    stage: ProgressStage,
    payload?: Record<string, unknown>
): void => {
    eventBroker.emitProgress({
        action,
        stage,
        payload,
        timestamp: new Date().toISOString()
    });
};

const toQueuePayload = (job: AnalysisQueueJobPayload): Record<string, unknown> => {
    return {
        ...job
    };
};

export const startAnalysis = async (
    input: AnalysisStartRequest,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService,
    eventBroker: RuntimeEventBroker
): Promise<void> => {
    emitProgress(eventBroker, OrchestrationAction.AnalysisStart, ProgressStage.Accepted, {
        analysisId: input.analysisId
    });

    for (const job of input.payload.jobs) {
        const queuePayload = toQueuePayload(job);
        await queueService.enqueue(ANALYSIS_QUEUE_NAME, {
            ...queuePayload,
            executionData: input.executionData
        });

        await redisConnectionService.projectJobStatus({
            ...(queuePayload as Record<string, unknown>),
            jobId: String(queuePayload.jobId),
            teamId: String(queuePayload.teamId),
            status: 'queued',
            queueType: ANALYSIS_QUEUE_NAME
        });
    }

    emitProgress(eventBroker, OrchestrationAction.AnalysisStart, ProgressStage.Queued, {
        analysisId: input.analysisId
    });
};

export const preprocessTrajectory = async (
    input: TrajectoryPreprocessRequest,
    queueService: QueueService,
    eventBroker: RuntimeEventBroker
): Promise<void> => {
    emitProgress(eventBroker, OrchestrationAction.TrajectoryPreprocess, ProgressStage.Accepted, {
        trajectoryId: input.trajectoryId
    });
    await queueService.enqueue(TRAJECTORY_QUEUE_NAME, {
        trajectoryId: input.trajectoryId,
        payload: input.payload,
        queuedAt: new Date().toISOString()
    });
    emitProgress(eventBroker, OrchestrationAction.TrajectoryPreprocess, ProgressStage.Queued, {
        trajectoryId: input.trajectoryId
    });
};

export const retryJobs = async (
    input: RetryJobsRequest,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): Promise<JobsActionResponse> => {
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

    return {
        affectedJobs
    };
};

export const removeRunningJobs = async (
    input: RemoveRunningJobsRequest,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): Promise<JobsActionResponse> => {
    let affectedJobs = 0;

    for (const jobId of input.jobIds) {
        const stopped = redisConnectionService.stopActiveProcess(jobId);
        const removed = await queueService.removeJob(ANALYSIS_QUEUE_NAME, jobId).catch(() => false);

        if (!stopped && !removed) {
            continue;
        }

        affectedJobs += 1;
    }

    return {
        affectedJobs
    };
};

export const clearJobsHistory = async (
    input: ClearJobsHistoryRequest,
    redisConnectionService: RedisConnectionService
): Promise<JobsActionResponse> => {
    const affectedJobs = input.jobIds.length > 0
        ? await redisConnectionService.removeJobs(input.teamId, input.jobIds)
        : await redisConnectionService.clearTeamJobs(input.teamId);

    return {
        affectedJobs
    };
};

export const rasterizeTrajectory = async (
    input: RasterizeTrajectoryRequest,
    minioService: MinioService,
    rasterizerService: RasterizerService
): Promise<{ triggered: boolean; }> => {
    const prefix = `trajectory-${input.trajectoryId}/`;
    const keys = await minioService.listObjects(ObjectBucketName.Models, prefix);
    const glbKeys = keys.filter((key) => key.endsWith('.glb'));

    if (glbKeys.length === 0) {
        return {
            triggered: false
        };
    }

    for (const key of glbKeys) {
        const match = key.match(/timestep-(\d+)\.glb$/);
        if (!match) {
            continue;
        }

        const timestep = Number(match[1]);
        const previewObjectKey = `trajectory-${input.trajectoryId}/previews/timestep-${timestep}.png`;
        await rasterizerService.rasterizePreview({
            inputBucket: ObjectBucketName.Models,
            inputObjectKey: key,
            outputObjectKey: previewObjectKey
        });
    }

    return {
        triggered: true
    };
};

export const uploadObject = async (
    input: ObjectUploadRequest,
    minioService: MinioService,
    eventBroker: RuntimeEventBroker
): Promise<void> => {
    const encoding = input.encoding || TextEncoding.Utf8;
    await minioService.putObject({
        bucket: input.bucket,
        objectKey: input.objectKey,
        body: Buffer.from(input.content, encoding),
        metadata: input.metadata
    });
    emitProgress(eventBroker, OrchestrationAction.ObjectUpload, ProgressStage.Completed, {
        bucket: input.bucket,
        objectKey: input.objectKey
    });
};

export const syncPluginBinary = async (
    input: PluginSyncRequest,
    minioService: MinioService,
    eventBroker: RuntimeEventBroker
): Promise<{ synced: boolean; objectKey: string; }> => {
    try {
        await minioService.statObject(ObjectBucketName.Plugins, input.objectKey);
    } catch {
        return {
            synced: false,
            objectKey: input.objectKey
        };
    }

    emitProgress(eventBroker, OrchestrationAction.PluginSync, ProgressStage.Completed, {
        pluginId: input.pluginId,
        objectKey: input.objectKey
    });

    return {
        synced: true,
        objectKey: input.objectKey
    };
};
