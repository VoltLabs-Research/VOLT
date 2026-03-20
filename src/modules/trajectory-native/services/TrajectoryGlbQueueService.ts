import { TRAJECTORY_GLB_QUEUE_NAME } from '@/modules/platform/services';
import { enqueueProjectedJob } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import { logger } from '@/core/logger';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import type {
    EnqueuePreprocessingRequest,
    EnqueuePreprocessingResponse,
    EnqueuePreprocessingFrameDescriptor,
    GlbConversionQueueJobPayload
} from '@/shared/contracts';

interface EnqueueGlbJobsResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
};

const buildGlbJobId = (trajectoryId: string, timestep: number): string => {
    return `trajectory-glb:${trajectoryId}:${timestep}`;
};

const buildGlbJobPayload = (
    input: EnqueuePreprocessingRequest,
    frame: EnqueuePreprocessingFrameDescriptor
): GlbConversionQueueJobPayload => {
    const timestamp = new Date().toISOString();

    return {
        jobId: buildGlbJobId(input.trajectoryId, frame.timestep),
        teamId: input.teamId,
        trajectoryId: input.trajectoryId,
        trajectoryName: input.trajectoryName,
        timestep: frame.timestep,
        objectKey: frame.objectKey,
        status: 'queued',
        queueType: TRAJECTORY_GLB_QUEUE_NAME,
        metadata: {
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
            timestep: frame.timestep
        },
        createdAt: timestamp,
        updatedAt: timestamp
    };
};

const STAT_CONCURRENCY = 10;

/**
 * Verifies which dump objects actually exist in S3 before enqueueing jobs.
 * Returns a Set of objectKeys that exist.
 */
const getExistingDumpKeys = async (
    minioService: MinioService,
    frames: EnqueuePreprocessingFrameDescriptor[]
): Promise<Set<string>> => {
    const existingKeys = new Set<string>();

    for (let i = 0; i < frames.length; i += STAT_CONCURRENCY) {
        const batch = frames.slice(i, i + STAT_CONCURRENCY);
        const results = await Promise.all(
            batch.map(async (frame): Promise<string | null> => {
                try {
                    await minioService.statObject(ObjectBucketName.Dumps, frame.objectKey);
                    return frame.objectKey;
                } catch (error: unknown) {
                    if (
                        error !== null &&
                        typeof error === 'object' &&
                        ('code' in error && (
                            (error as Record<string, unknown>).code === 'NotFound' ||
                            (error as Record<string, unknown>).code === 'NoSuchKey'
                        ) ||
                        'statusCode' in error && (error as Record<string, unknown>).statusCode === 404)
                    ) {
                        return null;
                    }

                    throw error;
                }
            })
        );

        for (const key of results) {
            if (key !== null) {
                existingKeys.add(key);
            }
        }
    }

    return existingKeys;
};

export interface TrajectoryGlbQueueService {
    enqueueGlbConversionJobs(input: EnqueuePreprocessingRequest): Promise<EnqueuePreprocessingResponse>;
};

export const createTrajectoryGlbQueueService = (
    minioService: MinioService,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): TrajectoryGlbQueueService => ({
    async enqueueGlbConversionJobs(input) {
        const result: EnqueueGlbJobsResult = {
            queuedJobs: 0,
            duplicateJobs: 0,
            skippedJobs: 0
        };

        // Pre-flight: verify which dump objects actually exist in S3
        const existingKeys = await getExistingDumpKeys(minioService, input.frames);
        const missingCount = input.frames.length - existingKeys.size;

        if (missingCount > 0) {
            // List all objects under this trajectory prefix for diagnostic purposes
            const prefix = `trajectory-${input.trajectoryId}/`;
            let allKeysInPrefix: string[] = [];
            try {
                allKeysInPrefix = await minioService.listObjects(ObjectBucketName.Dumps, prefix);
            } catch {
                // Ignore listing errors
            }

            logger.warn(
                {
                    trajectoryId: input.trajectoryId,
                    totalFrames: input.frames.length,
                    missingDumps: missingCount,
                    existingDumps: existingKeys.size,
                    requestedKeys: input.frames.map(f => f.objectKey),
                    existingKeysVerified: [...existingKeys],
                    allKeysInBucketPrefix: allKeysInPrefix,
                    allKeysInBucketCount: allKeysInPrefix.length
                },
                'DIAG: Some dump objects do not exist in S3 — skipping GLB enqueue for missing frames'
            );
        } else {
            logger.info(
                {
                    trajectoryId: input.trajectoryId,
                    totalFrames: input.frames.length,
                    allExist: true
                },
                'DIAG: Pre-flight check passed — all dump objects verified in S3'
            );
        }

        for (const frame of input.frames) {
            if (!existingKeys.has(frame.objectKey)) {
                logger.debug(
                    {
                        objectKey: frame.objectKey,
                        timestep: frame.timestep,
                        trajectoryId: input.trajectoryId
                    },
                    'Skipping GLB enqueue — dump object not found in S3'
                );
                result.skippedJobs += 1;
                continue;
            }

            const job = buildGlbJobPayload(input, frame);
            const wasEnqueued = await enqueueProjectedJob({
                queueService,
                queueName: TRAJECTORY_GLB_QUEUE_NAME,
                job,
                projectJobStatus: (projectedJob) => redisConnectionService.projectJobStatus(projectedJob),
                preserveExistingJob: true
            });

            if (!wasEnqueued) {
                result.duplicateJobs += 1;
                continue;
            }

            result.queuedJobs += 1;
        }

        return result;
    }
});
