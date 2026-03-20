import { ObjectBucketName } from '@/shared/contracts';
import { logger } from '@/core/logger';
import {
    NativeModuleOperation
} from './NativeModuleLoader';
import { TrajectoryAutoPreviewClaimStore } from './TrajectoryAutoPreviewClaimStore';
import { createTrajectoryRasterQueueService } from './TrajectoryRasterQueueService';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import type { RasterizeTrajectoryRequest } from '@/shared/contracts';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { NativeModuleLoader, NativeTrajectoryRequest } from './NativeModuleLoader';
import type { TrajectoryRasterQueueService } from './TrajectoryRasterQueueService';
import type { TrajectoryParserService } from './TrajectoryParserService';

const readOptionalStringProperty = (input: object, key: string): string | undefined => {
    const value = Reflect.get(input, key);

    if (typeof value !== 'string' || value.length === 0) {
        return undefined;
    }

    return value;
};

const queueAutoPreviewRasterization = async (
    trajectoryRasterQueueService: TrajectoryRasterQueueService,
    modelObjectKey: string,
    input: NativeTrajectoryRequest
): Promise<void> => {
    const teamId = readOptionalStringProperty(input, 'teamId');

    if (!teamId) {
        logger.warn(
            {
                modelObjectKey,
                timestep: input.timestep,
                trajectoryId: input.trajectoryId
            },
            'Skipping auto-preview rasterization enqueue for generated GLB because teamId is missing'
        );

        return;
    }

    const trajectoryName = readOptionalStringProperty(input, 'trajectoryName');
    const queueInput: RasterizeTrajectoryRequest = {
        trajectoryId: input.trajectoryId,
        teamId,
        config: {
            autoPreview: true,
            timestep: input.timestep
        }
    };

    if (trajectoryName) {
        queueInput.trajectoryName = trajectoryName;
    }

    const queueResult = await trajectoryRasterQueueService.queueRasterizationJobs(queueInput);

    logger.info(
        {
            duplicateJobs: queueResult.duplicateJobs,
            modelObjectKey,
            queuedJobs: queueResult.queuedJobs,
            skippedJobs: queueResult.skippedJobs,
            timestep: input.timestep,
            trajectoryId: input.trajectoryId
        },
        'Handled auto-preview rasterization enqueue for generated GLB'
    );
};

export interface GlbExporterService {
    preprocessTrajectory(input: NativeTrajectoryRequest): Promise<void>;
};

export const createGlbExporterService = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader,
    trajectoryParserService: TrajectoryParserService,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): GlbExporterService => {
    const trajectoryAutoPreviewClaimStore = new TrajectoryAutoPreviewClaimStore(redisConnectionService);
    const trajectoryRasterQueueService = createTrajectoryRasterQueueService(
        minioService,
        queueService,
        redisConnectionService,
        trajectoryAutoPreviewClaimStore
    );

    return {
        async preprocessTrajectory(input) {
            nativeModuleLoader.traceOperation(NativeModuleOperation.ExportGlb, {
                objectKey: input.objectKey,
                timestep: input.timestep,
                trajectoryId: input.trajectoryId
            });
            const startTime = Date.now();

            logger.info(
                {
                    objectKey: input.objectKey,
                    timestep: input.timestep,
                    trajectoryId: input.trajectoryId
                },
                'Starting native trajectory preprocessing'
            );
            await trajectoryParserService.withDumpFile(input, async (dumpPath) => {
                const tempGlbPath = `${dumpPath}.glb`;
                const modelObjectKey = trajectoryParserService.getModelObjectKey(input.trajectoryId, input.timestep);

                try {
                    // Scope parsed tightly — release typed arrays before upload
                    {
                        const parsed = trajectoryParserService.parseTrajectory(dumpPath);
                        logger.info(
                            {
                                atomCount: parsed.metadata.natoms,
                                dumpPath,
                                headers: parsed.metadata.headers,
                                tempGlbPath,
                                timestep: parsed.metadata.timestep,
                                trajectoryId: input.trajectoryId
                            },
                            'Parsed trajectory ready for native GLB export'
                        );
                        logger.info(
                            {
                                tempGlbPath,
                                timestep: input.timestep,
                                trajectoryId: input.trajectoryId
                            },
                            'Invoking native GLB exporter'
                        );
                        const exported = nativeModuleLoader.getExporterModule().generateGLBToFile(
                            parsed.positions,
                            parsed.types,
                            parsed.min,
                            parsed.max,
                            tempGlbPath
                        );
                        if (!exported) {
                            throw new Error('Failed to export trajectory GLB');
                        }
                    }
                    // parsed is now out of scope — typed arrays eligible for GC

                    const glbStats = await fs.stat(tempGlbPath);
                    logger.info(
                        {
                            durationMs: Date.now() - startTime,
                            modelObjectKey,
                            sizeBytes: glbStats.size,
                            tempGlbPath,
                            timestep: input.timestep,
                            trajectoryId: input.trajectoryId
                        },
                        'Native GLB export completed'
                    );

                    await minioService.putObjectStream({
                        bucket: ObjectBucketName.Models,
                        objectKey: modelObjectKey,
                        stream: createReadStream(tempGlbPath),
                        size: glbStats.size,
                        metadata: {
                            'Content-Type': 'model/gltf-binary'
                        }
                    });
                    logger.info(
                        {
                            modelObjectKey,
                            timestep: input.timestep,
                            trajectoryId: input.trajectoryId
                        },
                        'Uploaded generated GLB artifact'
                    );

                    try {
                        await queueAutoPreviewRasterization(trajectoryRasterQueueService, modelObjectKey, input);
                    } catch (error: unknown) {
                        logger.warn(
                            {
                                err: error,
                                modelObjectKey,
                                timestep: input.timestep,
                                trajectoryId: input.trajectoryId
                            },
                            'Failed to enqueue auto-preview rasterization for generated GLB'
                        );
                    }

                    logger.info(
                        {
                            durationMs: Date.now() - startTime,
                            modelObjectKey,
                            timestep: input.timestep,
                            trajectoryId: input.trajectoryId
                        },
                        'Completed native trajectory preprocessing'
                    );
                } finally {
                    await fs.unlink(tempGlbPath).catch(() => {});
                }
            });
        }
    };
};
