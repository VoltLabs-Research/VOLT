import { ObjectBucketName } from '@/shared/contracts';
import { logger } from '@/core/logger';
import {
    NativeModuleOperation
} from './NativeModuleLoader';
import fs from 'node:fs/promises';
import type { MinioService } from '@/modules/platform/services';
import type { NativeModuleLoader, NativeTrajectoryRequest } from './NativeModuleLoader';
import type { RasterizerService } from './RasterizerService';
import type { TrajectoryParserService } from './TrajectoryParserService';

export interface GlbExporterService {
    preprocessTrajectory(input: NativeTrajectoryRequest): Promise<void>;
};

export const createGlbExporterService = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader,
    trajectoryParserService: TrajectoryParserService,
    rasterizerService: RasterizerService
): GlbExporterService => ({
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
            const parsed = trajectoryParserService.parseTrajectory(dumpPath);
            const tempGlbPath = `${dumpPath}.glb`;
            const tempPngPath = `${dumpPath}.png`;
            const modelObjectKey = trajectoryParserService.getModelObjectKey(input.trajectoryId, input.timestep);
            const previewObjectKey = trajectoryParserService.getPreviewObjectKey(input.trajectoryId, input.timestep);

            try {
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

                const glbBuffer = await fs.readFile(tempGlbPath);
                await minioService.putObject({
                    bucket: ObjectBucketName.Models,
                    objectKey: modelObjectKey,
                    body: glbBuffer,
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

                logger.info(
                    {
                        previewObjectKey,
                        tempGlbPath,
                        tempPngPath,
                        timestep: input.timestep,
                        trajectoryId: input.trajectoryId
                    },
                    'Starting native rasterization for generated GLB'
                );
                await rasterizerService.rasterizeLocalGlb(tempGlbPath, tempPngPath);

                const pngBuffer = await fs.readFile(tempPngPath);
                await minioService.putObject({
                    bucket: ObjectBucketName.Rasterizer,
                    objectKey: previewObjectKey,
                    body: pngBuffer,
                    metadata: {
                        'Content-Type': 'image/png',
                        'Cache-Control': 'public, max-age=86400'
                    }
                });
                logger.info(
                    {
                        durationMs: Date.now() - startTime,
                        previewObjectKey,
                        timestep: input.timestep,
                        trajectoryId: input.trajectoryId
                    },
                    'Completed native trajectory preprocessing'
                );
            } finally {
                await Promise.all([
                    fs.unlink(tempGlbPath).catch(() => {}),
                    fs.unlink(tempPngPath).catch(() => {})
                ]);
            }
        });
    }
});
