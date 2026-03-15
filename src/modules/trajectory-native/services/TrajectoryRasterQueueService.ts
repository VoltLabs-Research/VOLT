import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/modules/platform/services';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import { isRecord } from '@/shared/utilities/type-guards';
import type { RasterQueueJobPayload, RasterizeTrajectoryRequest, RasterizeTrajectoryResponse } from '@/shared/contracts';

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

export interface TrajectoryRasterQueueService {
    queueRasterizationJobs(input: RasterizeTrajectoryRequest): Promise<RasterizeTrajectoryResponse>;
};

const buildRasterJobId = (trajectoryId: string, timestep: number): string => {
    return `trajectory-raster:${trajectoryId}:${timestep}`;
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
            await minioService.statObject(ObjectBucketName.Models, model.outputObjectKey);
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
            timestep: model.timestep,
            source: 'manual-rasterization'
        },
        createdAt: timestamp,
        updatedAt: timestamp
    };
};

export const createTrajectoryRasterQueueService = (
    minioService: MinioService,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): TrajectoryRasterQueueService => ({
    async queueRasterizationJobs(input) {
        const prefix = `trajectory-${input.trajectoryId}/`;
        const keys = await minioService.listObjects(ObjectBucketName.Models, prefix);
        const rasterModels = keys
            .filter((key) => key.endsWith('.glb'))
            .map((key) => parseTrajectoryModel(input.trajectoryId, key))
            .filter((job): job is ParsedTrajectoryModel => job !== null);

        const existingOutputKeys = await getExistingOutputKeys(minioService, rasterModels);
        const rasterJobs = rasterModels.map((job) => buildRasterJobPayload(input, job));
        const result: QueueRasterizationJobsResult = {
            queuedJobs: 0,
            duplicateJobs: 0,
            skippedJobs: 0,
            alreadyRasterizedJobs: 0
        };

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

            await redisConnectionService.projectJobStatus(job);
            result.queuedJobs += 1;
        }

        return result;
    }
});
