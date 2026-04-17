import { ObjectBucketName } from '@/contracts';
import { logger } from '@/core/logger';
import { NativeModuleOperation } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RasterizeTrajectoryRequest } from '@/contracts';
import type { NativeModuleLoader, NativeTrajectoryRequest } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import type { TrajectoryRasterQueueService } from '@/modules/trajectory/application/raster/TrajectoryRasterQueueService';
import type { TrajectoryParserService } from '@/modules/trajectory/application/parsing/TrajectoryParserService';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { compressFileWithZstd } from '@/support/serialization/storage-codec';

export interface GlbExporterService {
    preprocessTrajectory(input: NativeTrajectoryRequest): Promise<void>;
};

const queueAutoPreviewRasterization = async (
    trajectoryRasterQueueService: TrajectoryRasterQueueService,
    modelObjectKey: string,
    input: NativeTrajectoryRequest
): Promise<void> => {
    const { ownerClusterId, teamId, trajectoryName } = input;

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

    if (!ownerClusterId) {
        logger.warn(
            {
                modelObjectKey,
                timestep: input.timestep,
                trajectoryId: input.trajectoryId
            },
            'Skipping auto-preview rasterization enqueue for generated GLB because ownerClusterId is missing'
        );

        return;
    }

    const queueInput: RasterizeTrajectoryRequest = {
        trajectoryId: input.trajectoryId,
        teamId,
        storageClusterId: ownerClusterId,
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

export class GlbExporterService {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly nativeModuleLoader: NativeModuleLoader,
        private readonly trajectoryParserService: TrajectoryParserService,
        private readonly trajectoryRasterQueueService: TrajectoryRasterQueueService
    ) {}

    async preprocessTrajectory(input: NativeTrajectoryRequest): Promise<void> {
        this.nativeModuleLoader.traceOperation(NativeModuleOperation.ExportGlb, {
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
        await this.trajectoryParserService.withDumpFile(input, async (dumpPath) => {
            const tempGlbPath = path.join(path.dirname(dumpPath), 'model.glb');
            const tempCompressedGlbPath = `${tempGlbPath}.zst`;
            const modelObjectKey = this.trajectoryParserService.getModelObjectKey(input.trajectoryId, input.timestep);

            {
                const parsed = this.trajectoryParserService.parseTrajectory(dumpPath);
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
                const exported = this.nativeModuleLoader.getExporterModule().generateGLBToFile(
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

            await compressFileWithZstd(tempGlbPath, tempCompressedGlbPath);
            const glbStats = await fs.stat(tempCompressedGlbPath);
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

            const ownerClusterId = input.ownerClusterId;
            if (!ownerClusterId) {
                throw new Error(`Missing GLB output owner cluster for trajectory ${input.trajectoryId}`);
            }

            await this.objectStore.putObjectStream({
                ownerClusterId,
                bucket: ObjectBucketName.Models,
                objectKey: modelObjectKey,
                stream: createReadStream(tempCompressedGlbPath),
                size: glbStats.size,
                metadata: {
                    'Content-Type': 'model/gltf-binary',
                    'Content-Encoding': 'zstd'
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
                await queueAutoPreviewRasterization(this.trajectoryRasterQueueService, modelObjectKey, input);
            } catch (error) {
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
        });
    }
}
