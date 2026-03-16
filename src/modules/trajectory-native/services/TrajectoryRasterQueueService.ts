import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/modules/platform/services';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import type { RasterQueueJobPayload, RasterizeTrajectoryRequest, RasterizeTrajectoryResponse } from '@/shared/contracts';
import { isRecord } from '@/shared/utilities/type-guards';

interface ParsedTrajectoryModel {
    modelObjectKey: string;
    outputObjectKey: string;
    timestep: number;
};

interface QueueRasterizationJobsResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
};

interface AutoPreviewRasterizationConfig {
    timestep: number;
};

export interface TrajectoryRasterQueueService {
    queueRasterizationJobs(input: RasterizeTrajectoryRequest): Promise<RasterizeTrajectoryResponse>;
};

const buildRasterJobId = (trajectoryId: string, timestep: number): string => {
    return `trajectory-raster:${trajectoryId}:${timestep}`;
};

const buildAutoPreviewRasterKey = (trajectoryId: string): string => {
    return `trajectory:${trajectoryId}:auto-preview-raster`;
};

const createQueueRasterizationJobsResult = (): QueueRasterizationJobsResult => {
    return {
        queuedJobs: 0,
        duplicateJobs: 0,
        skippedJobs: 0,
        alreadyRasterizedJobs: 0
    };
};

const createParsedTrajectoryModel = (trajectoryId: string, timestep: number): ParsedTrajectoryModel => {
    return {
        modelObjectKey: `trajectory-${trajectoryId}/timestep-${timestep}.glb`,
        outputObjectKey: `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`,
        timestep
    };
};

const readAutoPreviewRasterizationConfig = (
    input: RasterizeTrajectoryRequest
): AutoPreviewRasterizationConfig | null => {
    if (!isRecord(input.config) || input.config.autoPreview !== true) {
        return null;
    }

    if (typeof input.config.timestep !== 'number' || !Number.isFinite(input.config.timestep)) {
        return null;
    }

    return {
        timestep: input.config.timestep
    };
};

const claimAutoPreviewRasterization = async (
    redisConnectionService: RedisConnectionService,
    trajectoryId: string
): Promise<boolean> => {
    return redisConnectionService.setKeyIfAbsent(
        buildAutoPreviewRasterKey(trajectoryId),
        new Date().toISOString(),
    );
};

const releaseAutoPreviewRasterizationClaim = async (
    redisConnectionService: RedisConnectionService,
    trajectoryId: string
): Promise<void> => {
    await redisConnectionService.deleteKey(buildAutoPreviewRasterKey(trajectoryId));
};

const isObjectNotFoundError = (error: unknown): boolean => {
    if (!isRecord(error)) {
        return false;
    }

    return error.code === 'NotFound'
        || error.code === 'NoSuchKey'
        || error.statusCode === 404
        || error.status === 404;
};

const getExistingOutputKeys = async (
    minioService: MinioService,
    models: ParsedTrajectoryModel[]
): Promise<Set<string>> => {
    const existingOutputKeys = new Set<string>();

    for (const model of models) {
        try {
            await minioService.statObject(ObjectBucketName.Rasterizer, model.outputObjectKey);
            existingOutputKeys.add(model.outputObjectKey);
        } catch (error) {
            if (isObjectNotFoundError(error)) {
                continue;
            }

            throw error;
        }
    }

    return existingOutputKeys;
};

const parseTrajectoryModel = (trajectoryId: string, objectKey: string): ParsedTrajectoryModel | null => {
    const match = objectKey.match(/timestep-(\d+)\.glb$/);
    if (!match) {
        return null;
    }

    const timestep = Number(match[1]);
    if (!Number.isFinite(timestep)) {
        return null;
    }

    return {
        modelObjectKey: objectKey,
        outputObjectKey: `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`,
        timestep
    };
};

const buildRasterJobPayload = (input: RasterizeTrajectoryRequest, model: ParsedTrajectoryModel): RasterQueueJobPayload => {
    const timestamp = new Date().toISOString();

    return {
        jobId: buildRasterJobId(input.trajectoryId, model.timestep),
        teamId: input.teamId,
        trajectoryId: input.trajectoryId,
        trajectoryName: input.trajectoryName,
        timestep: model.timestep,
        modelObjectKey: model.modelObjectKey,
        outputObjectKey: model.outputObjectKey,
        status: 'queued',
        queueType: TRAJECTORY_RASTER_QUEUE_NAME,
        metadata: {
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
            timestep: model.timestep
        },
        createdAt: timestamp,
        updatedAt: timestamp
    };
};

const enqueueRasterJob = async (
    queueService: QueueService,
    redisConnectionService: RedisConnectionService,
    job: RasterQueueJobPayload
): Promise<boolean> => {
    const wasEnqueued = await queueService.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, job, {
        preserveExistingJob: true
    });

    if (!wasEnqueued) {
        return false;
    }

    await redisConnectionService.projectJobStatus(job);
    return true;
};

const queueAutoPreviewRasterizationJob = async (
    input: RasterizeTrajectoryRequest,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService,
    config: AutoPreviewRasterizationConfig
): Promise<RasterizeTrajectoryResponse> => {
    const result = createQueueRasterizationJobsResult();
    const wasClaimed = await claimAutoPreviewRasterization(redisConnectionService, input.trajectoryId);

    if (!wasClaimed) {
        result.skippedJobs += 1;
        result.duplicateJobs += 1;
        return result;
    }

    const job = buildRasterJobPayload(input, createParsedTrajectoryModel(input.trajectoryId, config.timestep));
    let wasEnqueued = false;

    try {
        wasEnqueued = await enqueueRasterJob(queueService, redisConnectionService, job);
    } catch (error) {
        await releaseAutoPreviewRasterizationClaim(redisConnectionService, input.trajectoryId);
        throw error;
    }

    if (!wasEnqueued) {
        result.skippedJobs += 1;
        result.duplicateJobs += 1;
        return result;
    }

    result.queuedJobs += 1;
    return result;
};

export const createTrajectoryRasterQueueService = (
    minioService: MinioService,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): TrajectoryRasterQueueService => ({
    async queueRasterizationJobs(input) {
        const autoPreviewRasterizationConfig = readAutoPreviewRasterizationConfig(input);

        if (autoPreviewRasterizationConfig) {
            return queueAutoPreviewRasterizationJob(
                input,
                queueService,
                redisConnectionService,
                autoPreviewRasterizationConfig
            );
        }

        const prefix = `trajectory-${input.trajectoryId}/`;
        const keys = await minioService.listObjects(ObjectBucketName.Models, prefix);
        const rasterModels = keys
            .filter((key) => key.endsWith('.glb'))
            .map((key) => parseTrajectoryModel(input.trajectoryId, key))
            .filter((job): job is ParsedTrajectoryModel => job !== null);

        const existingOutputKeys = await getExistingOutputKeys(minioService, rasterModels);
        const rasterJobs = rasterModels.map((job) => buildRasterJobPayload(input, job));
        const result = createQueueRasterizationJobsResult();

        for (const job of rasterJobs) {
            if (existingOutputKeys.has(job.outputObjectKey)) {
                result.skippedJobs += 1;
                result.alreadyRasterizedJobs += 1;
                continue;
            }

            const wasEnqueued = await enqueueRasterJob(queueService, redisConnectionService, job);

            if (!wasEnqueued) {
                result.skippedJobs += 1;
                result.duplicateJobs += 1;
                continue;
            }

            result.queuedJobs += 1;
        }

        return result;
    }
});
