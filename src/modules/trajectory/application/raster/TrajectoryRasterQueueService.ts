import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { QueueService } from '@/core/queues/application/QueueService';
import { ObjectBucketName } from '@/contracts';
import type { QueuedJobNotification, RasterQueueJobPayload, RasterizeTrajectoryRequest, RasterizeTrajectoryResponse } from '@/contracts';
import { isRecord } from '@/support/type-guards/isRecord';
import type { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';

interface ParsedRasterModel {
    modelObjectKey: string;
    outputObjectKey: string;
    timestep: number;
    analysisId?: string;
    model?: string;
};

interface RasterJobMetadata {
    trajectoryId: string;
    trajectoryName?: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    autoPreview: boolean;
}

type RasterQueueJob = RasterQueueJobPayload & {
    metadata: RasterJobMetadata;
};

interface ObjectNotFoundError extends Error {
    code?: 'NoSuchKey' | 'NotFound';
    status?: number;
    statusCode?: number;
}

interface QueueRasterizationJobsResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
    jobs: QueuedJobNotification[];
};

interface AutoPreviewRasterizationConfig {
    timestep: number;
};

export interface TrajectoryRasterQueueService {
    queueRasterizationJobs(input: RasterizeTrajectoryRequest): Promise<RasterizeTrajectoryResponse>;
};

const createQueueRasterizationJobsResult = (): QueueRasterizationJobsResult => {
    return {
        queuedJobs: 0,
        duplicateJobs: 0,
        skippedJobs: 0,
        alreadyRasterizedJobs: 0,
        jobs: []
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

const STAT_CONCURRENCY = 10;

const ANALYSIS_MODEL_PATTERN = /^trajectory-[^/]+\/analysis-([^/]+)\/glb\/(\d+)\/([^/]+)\.glb\.zst$/;

const getExistingOutputKeys = async (
    objectStore: ClusterObjectStore,
    ownerClusterId: string,
    models: ParsedRasterModel[]
): Promise<Set<string>> => {
    const existingOutputKeys = new Set<string>();

    for (let i = 0; i < models.length; i += STAT_CONCURRENCY) {
        const batch = models.slice(i, i + STAT_CONCURRENCY);
        const results = await Promise.all(
            batch.map(async (rasterModel): Promise<string | null> => {
                try {
                    await objectStore.head(ownerClusterId, ObjectBucketName.Rasterizer, rasterModel.outputObjectKey);
                    return rasterModel.outputObjectKey;
                } catch (error) {
                    const objectStoreError = error as ObjectNotFoundError;
                    if (
                        objectStoreError.code === 'NotFound'
                        || objectStoreError.code === 'NoSuchKey'
                        || objectStoreError.statusCode === 404
                        || objectStoreError.status === 404
                    ) {
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
    const match = objectKey.match(/timestep-(\d+)\.glb\.zst$/);
    if (!match) {
        return null;
    }

    const timestep = Number.parseInt(match[1], 10);

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
    const timestep = Number.parseInt(match[2], 10);
    const nodeId = match[3];

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
): RasterQueueJob => {
    const timestamp = new Date().toISOString();

    return {
        jobId: rasterModel.analysisId && rasterModel.model
            ? `trajectory-raster_${input.trajectoryId}_${rasterModel.analysisId}_${rasterModel.timestep}_${rasterModel.model}`
            : `trajectory-raster_${input.trajectoryId}_${rasterModel.timestep}`,
        teamId: input.teamId,
        trajectoryId: input.trajectoryId,
        trajectoryName: input.trajectoryName,
        timestep: rasterModel.timestep,
        modelObjectKey: rasterModel.modelObjectKey,
        modelOwnerClusterId: input.storageClusterId,
        outputObjectKey: rasterModel.outputObjectKey,
        outputOwnerClusterId: input.storageClusterId,
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

const toQueuedJobNotification = (job: RasterQueueJob): QueuedJobNotification => ({
    jobId: job.jobId,
    name: 'Rasterize trajectory preview',
    teamId: job.teamId,
    timestep: job.timestep,
    trajectoryId: job.trajectoryId,
    trajectoryName: job.trajectoryName,
    analysisId: job.metadata.analysisId,
    queueType: TRAJECTORY_RASTER_QUEUE_NAME
});

const queueAutoPreviewRasterizationJob = async (
    input: RasterizeTrajectoryRequest,
    queueService: QueueService,
    trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore,
    config: AutoPreviewRasterizationConfig
): Promise<RasterizeTrajectoryResponse> => {
    const result = createQueueRasterizationJobsResult();
    const wasClaimed = await trajectoryAutoPreviewClaimStore.claimRasterization(input.trajectoryId);

    if (!wasClaimed) {
        result.skippedJobs += 1;
        result.duplicateJobs += 1;
        return result;
    }

    const job = buildRasterJobPayload(
        input,
        {
            modelObjectKey: `trajectory-${input.trajectoryId}/timestep-${config.timestep}.glb.zst`,
            outputObjectKey: `trajectory-${input.trajectoryId}/previews/timestep-${config.timestep}.png`,
            timestep: config.timestep
        },
        true
    );
    let wasEnqueued = false;

    try {
        wasEnqueued = await queueService.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, job, {
            preserveExistingJob: true
        });
    } catch (error) {
        await trajectoryAutoPreviewClaimStore.releaseRasterization(input.trajectoryId);
        throw error;
    }

    if (!wasEnqueued) {
        await trajectoryAutoPreviewClaimStore.releaseRasterization(input.trajectoryId);
        result.skippedJobs += 1;
        result.duplicateJobs += 1;
        return result;
    }

    result.queuedJobs += 1;
    result.jobs.push(toQueuedJobNotification(job));
    return result;
};

export const createTrajectoryRasterQueueService = (
    objectStore: ClusterObjectStore,
    queueService: QueueService,
    trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore
): TrajectoryRasterQueueService => ({
    async queueRasterizationJobs(input) {
        if (!input.storageClusterId) {
            throw new Error(`Missing storageClusterId for rasterization of trajectory ${input.trajectoryId}`);
        }

        const autoPreviewRasterizationConfig = readAutoPreviewRasterizationConfig(input);

        if (autoPreviewRasterizationConfig) {
            return queueAutoPreviewRasterizationJob(
                input,
                queueService,
                trajectoryAutoPreviewClaimStore,
                autoPreviewRasterizationConfig
            );
        }

        const prefix = `trajectory-${input.trajectoryId}/`;
        const keys: string[] = [];
        let cursor: string | undefined;

        do {
            const page = await objectStore.list(input.storageClusterId, {
                bucket: ObjectBucketName.Models,
                prefix,
                cursor,
                limit: 200
            });
            keys.push(...page.keys);
            cursor = page.nextCursor;
        } while (cursor);
        const glbKeys = keys.filter((key) => key.endsWith('.glb.zst'));

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

        const existingOutputKeys = await getExistingOutputKeys(
            objectStore,
            input.storageClusterId,
            rasterModels
        );
        const rasterJobs = rasterModels.map((rasterModel) => buildRasterJobPayload(input, rasterModel));
        const result = createQueueRasterizationJobsResult();

        for (const job of rasterJobs) {
            if (existingOutputKeys.has(job.outputObjectKey)) {
                result.skippedJobs += 1;
                result.alreadyRasterizedJobs += 1;
                continue;
            }

            const wasEnqueued = await queueService.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, job, {
                preserveExistingJob: true
            });

            if (!wasEnqueued) {
                result.skippedJobs += 1;
                result.duplicateJobs += 1;
                continue;
            }

            result.queuedJobs += 1;
            result.jobs.push(toQueuedJobNotification(job));
        }

        return result;
    }
});
