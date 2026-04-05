import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/modules/platform/services';
import type { QueueService } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import type {
    QueuedJobNotification,
    RasterQueueJobPayload,
    RasterizeTrajectoryRequest,
    RasterizeTrajectoryResponse
} from '@/shared/contracts';
import { isRecord } from '@/shared/utilities/type-guards';
import type { TrajectoryAutoPreviewClaimStore } from './TrajectoryAutoPreviewClaimStore';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

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
    jobs: QueuedJobNotification[];
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

const createQueueRasterizationJobsResult = (): QueueRasterizationJobsResult => {
    return {
        queuedJobs: 0,
        duplicateJobs: 0,
        skippedJobs: 0,
        alreadyRasterizedJobs: 0,
        jobs: []
    };
};

const createParsedRasterModel = (trajectoryId: string, timestep: number): ParsedRasterModel => {
    return {
        modelObjectKey: `trajectory-${trajectoryId}/timestep-${timestep}.glb.zst`,
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

const STAT_CONCURRENCY = 10;

const ANALYSIS_MODEL_PATTERN = /^trajectory-[^/]+\/analysis-([^/]+)\/glb\/(\d+)\/([^/]+)\.glb\.zst$/;

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
    const match = objectKey.match(/timestep-(\d+)\.glb\.zst$/);
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

const toQueuedJobNotification = (job: RasterQueueJobPayload): QueuedJobNotification => ({
    jobId: job.jobId,
    name: 'Rasterize trajectory preview',
    teamId: job.teamId,
    timestep: job.timestep,
    trajectoryId: job.trajectoryId,
    trajectoryName: job.trajectoryName,
    analysisId: typeof job.metadata?.analysisId === 'string' ? job.metadata.analysisId : undefined,
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
        createParsedRasterModel(input.trajectoryId, config.timestep),
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
