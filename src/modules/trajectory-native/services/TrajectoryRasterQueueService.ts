import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/modules/platform/services';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import type { RasterQueueJobPayload, RasterizeTrajectoryRequest, RasterizeTrajectoryResponse } from '@/shared/contracts';
import { isRecord } from '@/shared/utilities/type-guards';

interface ParsedRasterModel {
    modelObjectKey: string;
    outputObjectKey: string;
    timestep: number;
    analysisId?: string;
    model?: string;
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

const buildRasterJobId = (
    trajectoryId: string,
    timestep: number,
    analysisId?: string,
    model?: string
): string => {
    if (analysisId && model) {
        return `trajectory-raster_${trajectoryId}_${analysisId}_${timestep}_${model}`;
    }

    return `trajectory-raster_${trajectoryId}_${timestep}`;
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

const createParsedRasterModel = (trajectoryId: string, timestep: number): ParsedRasterModel => {
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

const STAT_CONCURRENCY = 10;

const ANALYSIS_MODEL_PATTERN = /^trajectory-[^/]+\/analysis-([^/]+)\/glb\/(\d+)\/([^/]+)\.glb$/;

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
    models: ParsedRasterModel[]
): Promise<Set<string>> => {
    const existingOutputKeys = new Set<string>();

    for (let i = 0; i < models.length; i += STAT_CONCURRENCY) {
        const batch = models.slice(i, i + STAT_CONCURRENCY);
        const results = await Promise.all(
            batch.map(async (rasterModel): Promise<string | null> => {
                try {
                    await minioService.statObject(ObjectBucketName.Rasterizer, rasterModel.outputObjectKey);
                    return rasterModel.outputObjectKey;
                } catch (error) {
                    if (isObjectNotFoundError(error)) {
                        return null;
                    }

                    throw error;
                }
            })
        );

        for (const key of results) {
            if (key !== null) {
                existingOutputKeys.add(key);
            }
        }
    }

    return existingOutputKeys;
};

const parseTrajectoryModel = (trajectoryId: string, objectKey: string): ParsedRasterModel | null => {
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

const parseAnalysisModel = (trajectoryId: string, objectKey: string): ParsedRasterModel | null => {
    const match = objectKey.match(ANALYSIS_MODEL_PATTERN);
    if (!match) {
        return null;
    }

    const analysisId = match[1];
    const timestep = Number(match[2]);
    const nodeId = match[3];

    if (!Number.isFinite(timestep)) {
        return null;
    }

    return {
        modelObjectKey: objectKey,
        outputObjectKey: `trajectory-${trajectoryId}/analysis-${analysisId}/raster/${timestep}_${nodeId}.png`,
        timestep,
        analysisId,
        model: nodeId
    };
};

const buildRasterJobPayload = (
    input: RasterizeTrajectoryRequest,
    rasterModel: ParsedRasterModel,
    autoPreview = false
): RasterQueueJobPayload => {
    const timestamp = new Date().toISOString();

    return {
        jobId: buildRasterJobId(input.trajectoryId, rasterModel.timestep, rasterModel.analysisId, rasterModel.model),
        teamId: input.teamId,
        trajectoryId: input.trajectoryId,
        trajectoryName: input.trajectoryName,
        timestep: rasterModel.timestep,
        modelObjectKey: rasterModel.modelObjectKey,
        outputObjectKey: rasterModel.outputObjectKey,
        status: 'queued',
        queueType: TRAJECTORY_RASTER_QUEUE_NAME,
        metadata: {
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
            timestep: rasterModel.timestep,
            ...(rasterModel.analysisId ? { analysisId: rasterModel.analysisId } : {}),
            ...(rasterModel.model ? { model: rasterModel.model } : {}),
            autoPreview
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

const enqueueRasterJobs = async (
    queueService: QueueService,
    redisConnectionService: RedisConnectionService,
    jobs: RasterQueueJobPayload[]
): Promise<{
    queuedJobs: RasterQueueJobPayload[];
    duplicateJobs: RasterQueueJobPayload[];
}> => {
    const enqueueResult = await queueService.enqueueMany(TRAJECTORY_RASTER_QUEUE_NAME, jobs, {
        preserveExistingJob: true
    });

    await Promise.all(enqueueResult.enqueuedPayloads.map((job) => redisConnectionService.projectJobStatus(job)));

    return {
        queuedJobs: enqueueResult.enqueuedPayloads,
        duplicateJobs: enqueueResult.skippedPayloads
    };
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

    const job = buildRasterJobPayload(
        input,
        createParsedRasterModel(input.trajectoryId, config.timestep),
        true
    );
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
        const glbKeys = keys.filter((key) => key.endsWith('.glb'));

        const rasterModels: ParsedRasterModel[] = [];
        for (const key of glbKeys) {
            const trajectoryModel = parseTrajectoryModel(input.trajectoryId, key);
            if (trajectoryModel) {
                rasterModels.push(trajectoryModel);
                continue;
            }

            const analysisModel = parseAnalysisModel(input.trajectoryId, key);
            if (analysisModel) {
                rasterModels.push(analysisModel);
            }
        }

        const existingOutputKeys = await getExistingOutputKeys(minioService, rasterModels);
        const rasterJobs = rasterModels.map((rasterModel) => buildRasterJobPayload(input, rasterModel));
        const result = createQueueRasterizationJobsResult();
        const queueableJobs = rasterJobs.filter((job) => !existingOutputKeys.has(job.outputObjectKey));

        result.skippedJobs += rasterJobs.length - queueableJobs.length;
        result.alreadyRasterizedJobs += rasterJobs.length - queueableJobs.length;

        const enqueueResult = await enqueueRasterJobs(queueService, redisConnectionService, queueableJobs);
        result.queuedJobs += enqueueResult.queuedJobs.length;
        result.skippedJobs += enqueueResult.duplicateJobs.length;
        result.duplicateJobs += enqueueResult.duplicateJobs.length;

        return result;
    }
});
