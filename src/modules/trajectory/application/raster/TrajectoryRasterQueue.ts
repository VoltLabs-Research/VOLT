import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { QueueService } from '@/core/queues/application/QueueService';
import { ObjectBucketName } from '@/contracts';
import type { RasterQueueJobPayload, RasterizeTrajectoryRequest, RasterizeTrajectoryResponse } from '@/contracts';
import { isRecord } from '@/support/type-guards/is-record';
import type { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { buildRasterJobPayload, type ParsedRasterModel } from '@/modules/trajectory/domain/raster/raster-job-factory';
import { toQueuedJobNotification } from '@/support/queue/to-queued-job-notification';

const RASTER_JOB_NAME = 'Rasterize trajectory preview';

interface ObjectNotFoundError extends Error {
    code?: 'NoSuchKey' | 'NotFound';
    status?: number;
    statusCode?: number;
}

interface AutoPreviewRasterizationConfig {
    timestep: number;
}

const createQueueRasterizationJobsResult = (): RasterizeTrajectoryResponse => {
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
        { autoPreview: true }
    );

    try {
        const wasEnqueued = await queueService.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, job, {
            preserveExistingJob: true
        });

        if (!wasEnqueued) {
            await trajectoryAutoPreviewClaimStore.releaseRasterization(input.trajectoryId);
            result.skippedJobs += 1;
            result.duplicateJobs += 1;
            return result;
        }
    } catch (error) {
        await trajectoryAutoPreviewClaimStore.releaseRasterization(input.trajectoryId);
        throw error;
    }

    result.queuedJobs += 1;
    result.jobs.push(toQueuedJobNotification(job, RASTER_JOB_NAME));
    return result;
};

export class TrajectoryRasterQueue {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly queueService: QueueService,
        private readonly trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore
    ) {}

    async queueRasterizationJobs(input: RasterizeTrajectoryRequest): Promise<RasterizeTrajectoryResponse> {
        if (!input.storageClusterId) {
            throw new Error(`Missing storageClusterId for rasterization of trajectory ${input.trajectoryId}`);
        }

        const autoPreviewRasterizationConfig = readAutoPreviewRasterizationConfig(input);

        if (autoPreviewRasterizationConfig) {
            return queueAutoPreviewRasterizationJob(
                input,
                this.queueService,
                this.trajectoryAutoPreviewClaimStore,
                autoPreviewRasterizationConfig
            );
        }

        const prefix = `trajectory-${input.trajectoryId}/`;
        const keys: string[] = [];
        let cursor: string | undefined;

        do {
            const page = await this.objectStore.list(input.storageClusterId, {
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
            this.objectStore,
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

            const wasEnqueued = await this.queueService.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, job, {
                preserveExistingJob: true
            });

            if (!wasEnqueued) {
                result.skippedJobs += 1;
                result.duplicateJobs += 1;
                continue;
            }

            result.queuedJobs += 1;
            result.jobs.push(toQueuedJobNotification(job, RASTER_JOB_NAME));
        }

        return result;
    }
}
